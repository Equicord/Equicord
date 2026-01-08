/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { ChannelToolbarButton } from "@api/HeaderBar";
import { isPluginEnabled } from "@api/PluginManager";
import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { Heading } from "@components/Heading";
import { EquicordDevs } from "@utils/constants";
import { closeModal, ModalCloseButton, ModalContent, ModalHeader, ModalProps, ModalRoot, ModalSize, openModal } from "@utils/modal";
import definePlugin, { OptionType } from "@utils/types";
import { ChannelStore, PermissionsBits, PermissionStore, React, SelectedChannelStore, UserStore, useStateFromStores } from "@webpack/common";

import { isFullscreenActive, openFullscreenView, resetFullscreenState } from "./components/FullscreenView";
import { GalleryView } from "./components/GalleryView";
import { SingleView } from "./components/SingleView";
import { log } from "./utils/logging";
import { extractImages, GalleryIcon, GalleryItem } from "./utils/media";
import { fetchMessagesChunk } from "./utils/pagination";

export const settings = definePluginSettings({
    includeGifs: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Include GIFs in the gallery",
    },
    includeEmbeds: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Include embed images in the gallery (Some may not render)",
    },
    enableVideos: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Enable videos in the gallery",
    },
    showCaptions: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Show filename captions on thumbnails",
    },
    chunkSize: {
        type: OptionType.NUMBER,
        default: 100,
        description: "Messages fetched per chunk (25–100, Discord API limit)",
        isValid: v => {
            const num = typeof v === "string" ? Number(v) : v;
            return Number.isFinite(num) && num >= 25 && num <= 100;
        },
    },
    preloadChunks: {
        type: OptionType.NUMBER,
        default: 3,
        description: "Chunks to preload when opening (1–5 recommended)",
        isValid: v => {
            const num = typeof v === "string" ? Number(v) : v;
            return Number.isFinite(num) && num >= 1 && num <= 5;
        },
    }
});

type ViewMode = "closed" | "gallery" | "single" | "fullscreen";

type GalleryState = {
    mode: ViewMode;
    channelId: string | null;
    selectedStableId: string | null;
    singleViewItems?: GalleryItem[]; // Filtered items for SingleView navigation
    // Preserve filter state when returning from fullscreen
    mediaFilter?: string;
    usernameFilter?: string;
    currentPage?: number;
    scrollPosition?: number;
};

type GalleryCache = {
    items: GalleryItem[];
    stableIds: Set<string>;
    failedIds: Set<string>;
    oldestMessageId: string | null;
    hasMore: boolean;
};

const cacheByChannel = new Map<string, GalleryCache>();

function getOrCreateCache(channelId: string): GalleryCache {
    if (!channelId) {
        log.warn("data", "getOrCreateCache called without channelId");
        return {
            items: [],
            stableIds: new Set(),
            failedIds: new Set(),
            oldestMessageId: null,
            hasMore: true
        };
    }

    const existing = cacheByChannel.get(channelId);
    if (existing) {
        log.debug("data", "Using existing cache", {
            channelId,
            items: existing.items.length
        });
        return existing;
    }

    log.info("data", "Creating new gallery cache", { channelId });

    const created: GalleryCache = {
        items: [],
        stableIds: new Set(),
        failedIds: new Set(),
        oldestMessageId: null,
        hasMore: true
    };

    cacheByChannel.set(channelId, created);
    return created;
}

function isSupportedChannel(channel: { isDM?: () => boolean; isGroupDM?: () => boolean; isMultiUserDM?: () => boolean; isThread?: () => boolean; isGuildVocal?: () => boolean; isCategory?: () => boolean; guild_id?: string; } | null | undefined): boolean {
    if (!channel) return false;
    // Support DMs, Group DMs, and Multi-User DMs
    if (typeof channel.isDM === "function" && channel.isDM()) return true;
    if (typeof channel.isGroupDM === "function" && channel.isGroupDM()) return true;
    if (typeof channel.isMultiUserDM === "function" && channel.isMultiUserDM()) return true;
    if (typeof channel.isGuildVocal === "function" && channel.isGuildVocal()) return false;
    if (typeof channel.isCategory === "function" && channel.isCategory()) return false;
    if (typeof channel.isThread === "function" && channel.isThread()) return true;
    return !!channel.guild_id;
}

function canUseGallery(channel: { guild_id?: string; isDM?: () => boolean; isGroupDM?: () => boolean; isMultiUserDM?: () => boolean; } | null | undefined): boolean {
    if (!channel) return false;
    if (!isSupportedChannel(channel)) return false;
    // For guild channels, check VIEW_CHANNEL permission
    // For DMs, no permission check needed
    if (channel.guild_id && !PermissionStore.can(PermissionsBits.VIEW_CHANNEL, channel as any)) return false;
    return true;
}

let globalState: GalleryState = { mode: "closed", channelId: null, selectedStableId: null };
let modalKey: string | null = null;
const stateListeners = new Set<() => void>();
let pendingFullscreen: { items: GalleryItem[]; selectedStableId: string; channelId: string; } | null = null;
let isProcessingCloseCallback = false;
let isTransitioning = false; // Guard against fast clicking

// Reusable onCloseCallback that handles pendingFullscreen transitions
function createGalleryModalCloseCallback() {
    return () => {
        log.debug("lifecycle", "Gallery modal close callback", { pendingFullscreen: !!pendingFullscreen });

        if (isProcessingCloseCallback) {
            log.warn("lifecycle", "onCloseCallback: Already processing, ignoring");
            return;
        }
        isProcessingCloseCallback = true;
        modalKey = null;

        // Capture pendingFullscreen immediately to prevent race conditions
        const fullscreenData = pendingFullscreen;
        pendingFullscreen = null;

        if (fullscreenData) {
            log.info("lifecycle", "Transitioning to fullscreen view", fullscreenData);

            const { items, selectedStableId, channelId: fsChannelId } = fullscreenData;

            // Reset fullscreen state before opening to ensure clean state
            resetFullscreenState();
            isTransitioning = false; // Clear transition flag before opening

            // Store current filter state before opening fullscreen
            const currentState = globalState;

            // Use setTimeout to ensure modal is fully closed before opening fullscreen
            // This prevents race conditions with Discord's modal system
            setTimeout(() => {
                openFullscreenView(
                    items,
                    selectedStableId,
                    () => {
                        log.debug("lifecycle", "Returning from fullscreen to gallery view");

                        // Ensure fullscreen state is fully reset before returning to gallery
                        resetFullscreenState();
                        // Also reset transition flag to ensure new fullscreen can open
                        isTransitioning = false;

                        // Return to gallery mode, preserving filter state
                        setState({
                            mode: "gallery",
                            channelId: fsChannelId,
                            selectedStableId: null,
                            mediaFilter: currentState.mediaFilter,
                            usernameFilter: currentState.usernameFilter,
                            currentPage: currentState.currentPage,
                            scrollPosition: currentState.scrollPosition
                        });

                        // Open modal immediately for instant transition with the same callback handler
                        modalKey = openModal(
                            ErrorBoundary.wrap(modalProps => (
                                <GalleryModal
                                    {...modalProps}
                                    channelId={fsChannelId}
                                    settings={settings.store}
                                />
                            ), { noop: true }),
                            {
                                onCloseCallback: createGalleryModalCloseCallback()
                            }
                        );
                    }
                );
            }, 0);
        } else {
            log.info("lifecycle", "Gallery closed normally");
            isTransitioning = false;
            setState({ mode: "closed", channelId: null, selectedStableId: null });
        }

        isProcessingCloseCallback = false;
    };
}

function setState(updates: Partial<GalleryState>): void {
    const prev = globalState;
    globalState = { ...globalState, ...updates };

    log.debug("lifecycle", "Global gallery state updated", {
        prev,
        next: globalState
    });

    stateListeners.forEach(listener => listener());
}

function GalleryModal(props: ModalProps & { channelId: string; settings: typeof settings.store; }) {
    const { channelId, settings: pluginSettings, ...modalProps } = props;

    const channel = ChannelStore.getChannel(channelId);
    let title = "Gallery";
    if (channel) {
        if (typeof channel.isDM === "function" && channel.isDM()) {
            const recipientId = channel.recipients?.[0];
            const user = recipientId ? UserStore.getUser(recipientId) : null;
            const userName = user ? (user.globalName ?? user.username) : "DM";
            title = `Gallery — ${userName}`;
        } else if (typeof channel.isGroupDM === "function" && channel.isGroupDM()) {
            title = channel.name ? `Gallery — ${channel.name}` : "Gallery — Group DM";
        } else if (channel.name) {
            title = `Gallery — #${channel.name}`;
        }
    }

    const cache = React.useMemo(() => getOrCreateCache(channelId), [channelId]);
    const [items, setItems] = React.useState<GalleryItem[]>(() => cache.items);
    const [hasMore, setHasMore] = React.useState<boolean>(() => cache.hasMore);
    const [loading, setLoading] = React.useState<boolean>(false);
    const [error, setError] = React.useState<string | null>(null);
    const [localState, setLocalState] = React.useState<GalleryState>(() => globalState);

    // Filter out failed images
    const validItems = React.useMemo(() => {
        return items.filter(item => item && item.stableId && !cache.failedIds.has(item.stableId));
    }, [items, cache.failedIds]);

    const markAsFailed = React.useCallback((stableId: string) => {
        if (!stableId || cache.failedIds.has(stableId)) return;
        cache.failedIds.add(stableId);
        // Trigger re-render by updating items (validItems will automatically filter via useMemo)
        setItems(prev => prev.filter(item => item.stableId !== stableId));
    }, [cache]);

    const abortRef = React.useRef<AbortController | null>(null);
    const loadingRef = React.useRef<boolean>(false);

    // Subscribe to global state changes
    React.useEffect(() => {
        const listener = () => setLocalState({ ...globalState });
        stateListeners.add(listener);
        return () => { stateListeners.delete(listener); };
    }, []);

    React.useEffect(() => {
        return () => abortRef.current?.abort();
    }, []);

    const loadNextChunks = React.useCallback(async (chunks: number) => {
        if (loadingRef.current) return;
        if (!hasMore) return;

        log.perfStart("load-chunks");
        log.debug("data", "Loading message chunks", {
            channelId,
            chunks,
            chunkSize: pluginSettings.chunkSize
        });

        loadingRef.current = true;
        setLoading(true);
        setError(null);

        const controller = new AbortController();
        abortRef.current?.abort();
        abortRef.current = controller;

        try {
            let before = cache.oldestMessageId;
            let localHasMore = cache.hasMore;
            let loadedAny = false;

            for (let i = 0; i < chunks && localHasMore; i++) {
                const msgs = await fetchMessagesChunk({
                    channelId,
                    before,
                    limit: Math.max(1, Math.floor(pluginSettings.chunkSize)),
                    signal: controller.signal
                });

                if (!msgs.length) {
                    localHasMore = false;
                    break;
                }

                const lastMsg = msgs[msgs.length - 1];
                if (lastMsg && lastMsg.id) {
                    before = String(lastMsg.id);
                    cache.oldestMessageId = before;
                } else {
                    localHasMore = false;
                    break;
                }

                const extracted = extractImages(msgs, channelId, {
                    includeEmbeds: pluginSettings.includeEmbeds,
                    includeGifs: pluginSettings.includeGifs
                });

                for (const it of extracted) {
                    if (!it?.stableId) continue;
                    if (cache.stableIds.has(it.stableId)) continue;
                    cache.stableIds.add(it.stableId);
                    cache.items.push(it);
                }

                loadedAny = true;
            }

            log.debug("data", "Chunk load complete", {
                addedItems: cache.items.length,
                hasMore: localHasMore
            });

            if (loadedAny || !localHasMore) {
                cache.hasMore = localHasMore;
                // Filter out failed items when updating
                setItems([...cache.items.filter(item => !cache.failedIds.has(item.stableId))]);
                setHasMore(cache.hasMore);
            }
        } catch (e: unknown) {
            if (e instanceof Error && (e.name === "AbortError" || e.message === "AbortError")) {
                loadingRef.current = false;
                setLoading(false);
                return;
            }
            setError("Unable to load gallery items");
            if (cache.items.length === 0) {
                cache.hasMore = false;
                setHasMore(false);
            }
        } finally {
            loadingRef.current = false;
            setLoading(false);
            log.perfEnd("load-chunks");
        }
    }, [channelId, hasMore, pluginSettings.chunkSize, pluginSettings.includeEmbeds, pluginSettings.includeGifs, cache]);

    React.useEffect(() => {
        if (items.length > 0) return;
        if (loadingRef.current) return;
        void loadNextChunks(Math.max(1, Math.floor(pluginSettings.preloadChunks)));
    }, [channelId, items.length, pluginSettings.preloadChunks, loadNextChunks]);

    const handleSelect = React.useCallback((stableId: string, isVideo: boolean, filteredItems: GalleryItem[]) => {
        // Guard against rapid clicking
        if (isTransitioning || isFullscreenActive()) {
            log.debug("lifecycle", "handleSelect blocked", { isTransitioning, isFullscreenActive: isFullscreenActive() });
            return;
        }

        // Store current state before transitioning to preserve filter/page
        const currentState = localState;

        if (isVideo) {
            // Videos open in SingleView - pass only videos from filtered items
            isTransitioning = true;
            // Filter to only videos so navigation stays within videos
            const videoItems = filteredItems.filter(it => it.isVideo);
            // Preserve filter state and page when opening single view
            setState({
                mode: "single",
                channelId,
                selectedStableId: stableId,
                singleViewItems: videoItems,
                mediaFilter: currentState.mediaFilter,
                usernameFilter: currentState.usernameFilter,
                currentPage: currentState.currentPage,
                scrollPosition: currentState.scrollPosition
            });
            // Reset transition flag immediately after state update
            isTransitioning = false;
        } else {
            // Images and GIFs open directly in fullscreen
            const item = filteredItems.find(it => it && it.stableId === stableId);
            if (!item) {
                log.warn("lifecycle", "handleSelect: item not found", { stableId });
                isTransitioning = false;
                return;
            }

            // Always reset before opening to ensure clean state (defensive)
            resetFullscreenState();
            isTransitioning = true;

            // Filter out videos from fullscreen view - use the already filtered items
            // This ensures the gallery filter (Images, Animated, etc.) is respected
            const nonVideoItems = filteredItems.filter(it => !it.isVideo);
            if (nonVideoItems.length === 0) {
                log.warn("lifecycle", "handleSelect: no non-video items", { filteredItems: filteredItems.length });
                isTransitioning = false;
                return;
            }

            // Preserve filter state and page when opening fullscreen
            setState({
                mediaFilter: currentState.mediaFilter,
                usernameFilter: currentState.usernameFilter,
                currentPage: currentState.currentPage,
                scrollPosition: currentState.scrollPosition
            });

            // Set pending fullscreen BEFORE closing modal to prevent race conditions
            pendingFullscreen = {
                items: nonVideoItems,
                selectedStableId: stableId,
                channelId: channelId
            };

            log.info("lifecycle", "handleSelect: Setting pendingFullscreen and closing modal", {
                items: nonVideoItems.length,
                selectedStableId: stableId,
                channelId
            });

            // Close modal - this will trigger onCloseCallback which will open fullscreen
            modalProps.onClose();
        }
    }, [channelId, modalProps, localState]);

    const handleCloseSingle = React.useCallback(() => {
        // Preserve filter state and page when returning from single view
        setState({
            mode: "gallery",
            channelId,
            selectedStableId: null,
            singleViewItems: undefined,
            mediaFilter: localState.mediaFilter,
            usernameFilter: localState.usernameFilter,
            currentPage: localState.currentPage,
            scrollPosition: localState.scrollPosition
        });
    }, [channelId, localState.mediaFilter, localState.usernameFilter, localState.currentPage, localState.scrollPosition]);

    const handleClose = React.useCallback((e?: React.MouseEvent | KeyboardEvent) => {
        if (localState.mode === "single" && localState.channelId === channelId) {
            e?.preventDefault?.();
            e?.stopPropagation?.();
            setState({ mode: "gallery", channelId, selectedStableId: null });
            return;
        }

        // If we have a pending fullscreen, don't clear it - let onCloseCallback handle it
        // Only clear if this is a manual close (not a transition to fullscreen)
        if (!pendingFullscreen) {
            log.debug("lifecycle", "handleClose: Manual close, clearing state");
            // Always reset fullscreen state when gallery closes to prevent stale callbacks
            resetFullscreenState();
            abortRef.current?.abort();
            setState({ mode: "closed", channelId: null, selectedStableId: null });
        } else {
            log.debug("lifecycle", "handleClose: Pending fullscreen exists, skipping state clear");
        }
        modalProps.onClose();
    }, [localState.mode, localState.channelId, channelId, modalProps]);

    // Intercept Escape key and overlay clicks
    React.useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape" && (localState.mode === "single" || localState.mode === "gallery")) {
                e.preventDefault();
                e.stopPropagation();
                handleClose(e);
            }
        };

        window.addEventListener("keydown", handleEscape, true);
        return () => window.removeEventListener("keydown", handleEscape, true);
    }, [handleClose, localState.mode]);

    const isSingleView = localState.mode === "single" && localState.channelId === channelId;

    return (
        <ModalRoot {...modalProps} size={ModalSize.DYNAMIC} aria-label="Gallery" className="vc-gallery-modal-root">
            <ModalHeader className="vc-gallery-modal-header">
                <Heading tag="h3" className="vc-gallery-modal-title">
                    {title}
                </Heading>
                <ModalCloseButton onClick={handleClose} />
            </ModalHeader>
            <ModalContent className="vc-channel-gallery-modal">
                {isSingleView ? (
                    <SingleView
                        items={localState.singleViewItems ?? validItems.filter(it => it.isVideo)}
                        selectedStableId={localState.selectedStableId!}
                        cache={cache}
                        onClose={handleCloseSingle}
                        onChange={stableId => setState({ mode: "single", channelId, selectedStableId: stableId, singleViewItems: localState.singleViewItems })}
                        onMarkFailed={markAsFailed}
                    />
                ) : localState.mode === "gallery" ? (
                    <GalleryView
                        items={validItems}
                        showCaptions={pluginSettings.showCaptions}
                        isLoading={loading}
                        hasMore={hasMore}
                        error={error}
                        cache={cache}
                        enableVideos={pluginSettings.enableVideos}
                        userStore={UserStore}
                        onRetry={() => loadNextChunks(1)}
                        onLoadMore={() => loadNextChunks(1)}
                        onSelect={handleSelect}
                        onMarkFailed={markAsFailed}
                        // Pass preserved filter state
                        initialMediaFilter={localState.mediaFilter}
                        initialUsernameFilter={localState.usernameFilter}
                        initialCurrentPage={localState.currentPage}
                        initialScrollPosition={localState.scrollPosition}
                        onStateChange={state => {
                            // Update global state with filter changes
                            setState({
                                mediaFilter: state.mediaFilter,
                                usernameFilter: state.usernameFilter,
                                currentPage: state.currentPage,
                                scrollPosition: state.scrollPosition
                            });
                        }}
                    />
                ) : null}
            </ModalContent>
        </ModalRoot>
    );
}

function toggleGallery(channelId: string): void {
    if (!channelId) {
        log.warn("lifecycle", "toggleGallery called with no channelId");
        return;
    }

    if (modalKey) {
        log.debug("lifecycle", "Toggling gallery closed", { channelId });
        // Always reset fullscreen state when gallery closes to prevent stale callbacks
        resetFullscreenState();
        closeModal(modalKey);
        modalKey = null;
        setState({ mode: "closed", channelId: null, selectedStableId: null });
        return;
    }

    log.info("lifecycle", "Opening gallery modal", { channelId });

    setState({ mode: "gallery", channelId, selectedStableId: null });

    modalKey = openModal(
        ErrorBoundary.wrap(modalProps => (
            <GalleryModal
                {...modalProps}
                channelId={channelId}
                settings={settings.store}
            />
        ), { noop: true }),
        {
            onCloseCallback: createGalleryModalCloseCallback()
        }
    );
}

function GalleryToolbarButton() {
    const channelId = useStateFromStores([SelectedChannelStore], () => SelectedChannelStore.getChannelId());
    const channel = useStateFromStores(
        [ChannelStore, SelectedChannelStore],
        () => channelId ? ChannelStore.getChannel(channelId) : null,
        [channelId]
    );

    const supported = canUseGallery(channel);
    const selected = Boolean(modalKey && globalState.channelId === channelId && globalState.mode !== "closed");

    React.useEffect(() => {
        if (!modalKey || !globalState.channelId || globalState.channelId === channelId) return;
        closeModal(modalKey);
    }, [channelId]);

    const handleClick = () => {
        if (!channelId) return;
        toggleGallery(channelId);
    };

    return (
        <ChannelToolbarButton
            icon={GalleryIcon}
            tooltip="Gallery"
            disabled={!supported}
            selected={selected}
            onClick={handleClick}
        />
    );
}

export default definePlugin({
    name: "ChannelGallery",
    description: "Adds a Gallery view for images in the current channel",
    authors: [EquicordDevs.benjii, EquicordDevs.FantasticLoki],
    dependencies: ["HeaderBarAPI"],

    settings,

    patches: [
        {
            find: ".dimensionlessImage,",
            replacement: {
                match: /(?<=null!=(\i)\?.{0,20})\i\.\i,{children:\1/,
                replace: "'div',{onClick:e=>$self.handleMediaViewerClick(e),children:$1"
            },
            predicate: () => !isPluginEnabled("ImageZoom")
        },
    ],

    start() {
        log.info("lifecycle", "ChannelGallery plugin started");
    },

    handleMediaViewerClick(e: React.MouseEvent) {
        if (!e || e.button !== 0) return;
        try {
            if (e.stopPropagation) e.stopPropagation();
        } catch { }

        const el = e.currentTarget as HTMLElement | null;
        if (!el) return;
        if (typeof el.getBoundingClientRect !== "function") return;

        const rect = el.getBoundingClientRect();
        const x = (e.clientX ?? 0) - rect.left;
        const key = x < rect.width / 2 ? "ArrowLeft" : "ArrowRight";

        try {
            window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
        } catch { }
    },

    headerBarButton: {
        location: "channeltoolbar",
        icon: GalleryIcon,
        render: GalleryToolbarButton,
        priority: 250
    },

    stop() {
        log.info("lifecycle", "ChannelGallery plugin stopping");

        cacheByChannel.clear();

        if (modalKey) {
            log.debug("lifecycle", "Closing active gallery modal");
            closeModal(modalKey);
            modalKey = null;
        }

        setState({ mode: "closed", channelId: null, selectedStableId: null });
        stateListeners.clear();

        // Reset all state flags
        resetFullscreenState();
        pendingFullscreen = null;
        isProcessingCloseCallback = false;
        isTransitioning = false;

        log.info("lifecycle", "ChannelGallery plugin stopped");
    }
});
