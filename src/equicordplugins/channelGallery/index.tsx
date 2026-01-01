/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { ChannelToolbarButton } from "@api/HeaderBar";
import { isPluginEnabled } from "@api/PluginManager";
import { definePluginSettings } from "@api/Settings";
import { Button } from "@components/Button";
import ErrorBoundary from "@components/ErrorBoundary";
import { Heading } from "@components/Heading";
import { EquicordDevs } from "@utils/constants";
import { closeModal, ModalCloseButton, ModalContent, ModalHeader, ModalProps, ModalRoot, ModalSize, openModal } from "@utils/modal";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { ChannelStore, PermissionsBits, PermissionStore, React, SelectedChannelStore, UserStore, useStateFromStores } from "@webpack/common";

import { openFullscreenView } from "./components/FullscreenView";
import { GalleryView } from "./components/GalleryView";
import { SingleView } from "./components/SingleView";
import { extractImages, GalleryIcon, GalleryItem } from "./utils/media";
import { fetchMessagesChunk } from "./utils/pagination";

// Note: We don't use ChannelTypes anymore - we rely entirely on Channel class methods
// which are more reliable and don't require webpack module resolution
const jumper: any = findByPropsLazy("jumpToMessage");

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
        return { items: [], stableIds: new Set(), failedIds: new Set(), oldestMessageId: null, hasMore: true };
    }
    const existing = cacheByChannel.get(channelId);
    if (existing) return existing;
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
let isOpeningFullscreen = false;
let pendingFullscreen: { items: GalleryItem[]; selectedStableId: string; channelId: string; } | null = null;
let isProcessingCloseCallback = false;

function setState(updates: Partial<GalleryState>): void {
    globalState = { ...globalState, ...updates };
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
        }
    }, [channelId, hasMore, pluginSettings.chunkSize, pluginSettings.includeEmbeds, pluginSettings.includeGifs, cache]);

    React.useEffect(() => {
        if (items.length > 0) return;
        if (loadingRef.current) return;
        void loadNextChunks(Math.max(1, Math.floor(pluginSettings.preloadChunks)));
    }, [channelId, items.length, pluginSettings.preloadChunks, loadNextChunks]);

    const handleSelect = React.useCallback((stableId: string) => {
        setState({ mode: "single", channelId, selectedStableId: stableId });
    }, [channelId]);

    const handleCloseSingle = React.useCallback(() => {
        setState({ mode: "gallery", channelId, selectedStableId: null });
    }, [channelId]);

    const handleFullscreen = React.useCallback(() => {
        if (!localState.selectedStableId) return;
        if (items.length === 0) return;
        if (isOpeningFullscreen) return;
        if (localState.mode !== "single") return;

        isOpeningFullscreen = true;
        const currentStableId = localState.selectedStableId;
        const currentChannelId = channelId;
        const allItems = cache.items.length > items.length ? cache.items : items;

        if (!allItems || allItems.length === 0) {
            isOpeningFullscreen = false;
            return;
        }

        pendingFullscreen = {
            items: allItems,
            selectedStableId: currentStableId,
            channelId: currentChannelId
        };
        modalProps.onClose();
    }, [localState.selectedStableId, localState.mode, items, channelId, cache, modalProps]);

    const handleOpenMessage = React.useCallback(() => {
        if (!localState.selectedStableId) return;
        const item = items.find(it => it && it.stableId === localState.selectedStableId);
        if (!item || !item.messageId) return;

        try {
            jumper.jumpToMessage({
                channelId,
                messageId: item.messageId,
                flash: true,
                jumpType: "INSTANT"
            });
        } finally {
            modalProps.onClose();
        }
    }, [localState.selectedStableId, items, channelId, modalProps]);

    const downloadRef = React.useRef<HTMLAnchorElement | null>(null);

    const handleDownload = React.useCallback(async () => {
        if (!localState.selectedStableId) return;
        const item = items.find(it => it && it.stableId === localState.selectedStableId);
        if (!item || !item.url || !downloadRef.current) return;

        try {
            const response = await fetch(item.url);
            if (!response.ok) throw new Error("Failed to fetch image");

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            downloadRef.current.href = url;
            downloadRef.current.download = item.filename || "image";
            downloadRef.current.click();
            window.URL.revokeObjectURL(url);
        } catch {
            downloadRef.current.href = item.url;
            downloadRef.current.download = item.filename || "image";
            downloadRef.current.target = "_blank";
            downloadRef.current.click();
        }
    }, [localState.selectedStableId, items]);

    const handleClose = React.useCallback((e?: React.MouseEvent | KeyboardEvent) => {
        if (localState.mode === "single" && localState.channelId === channelId) {
            e?.preventDefault?.();
            e?.stopPropagation?.();
            setState({ mode: "gallery", channelId, selectedStableId: null });
            return;
        }

        abortRef.current?.abort();
        setState({ mode: "closed", channelId: null, selectedStableId: null });
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
            <a ref={downloadRef} style={{ display: "none" }} />
            <ModalHeader className="vc-gallery-modal-header">
                <Heading tag="h3" className="vc-gallery-modal-title">
                    {title}
                </Heading>
                {isSingleView && (
                    <>
                        <Button onClick={handleOpenMessage} variant="secondary" size="small" className="vc-gallery-button">
                            Open message
                        </Button>
                        <button onClick={handleDownload} className="vc-gallery-icon-button" aria-label="Download image">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="vc-gallery-icon">
                                <path d="M12 2a1 1 0 0 1 1 1v10.59l3.3-3.3a1 1 0 1 1 1.4 1.42l-5 5a1 1 0 0 1-1.4 0l-5-5a1 1 0 1 1 1.4-1.42l3.3 3.3V3a1 1 0 0 1 1-1ZM3 20a1 1 0 1 0 0 2h18a1 1 0 1 0 0-2H3Z" fill="currentColor" />
                            </svg>
                        </button>
                        <button onClick={handleFullscreen} className="vc-gallery-icon-button" aria-label="View fullscreen">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="vc-gallery-icon">
                                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" fill="currentColor" />
                            </svg>
                        </button>
                    </>
                )}
                <ModalCloseButton onClick={handleClose} />
            </ModalHeader>
            <ModalContent className="vc-channel-gallery-modal">
                {isSingleView ? (
                    <SingleView
                        items={validItems}
                        selectedStableId={localState.selectedStableId!}
                        channelId={channelId}
                        cache={cache}
                        onClose={handleCloseSingle}
                        onChange={handleSelect}
                        onOpenMessage={handleClose}
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
                        onRetry={() => loadNextChunks(1)}
                        onLoadMore={() => loadNextChunks(1)}
                        onSelect={handleSelect}
                        onMarkFailed={markAsFailed}
                    />
                ) : null}
            </ModalContent>
        </ModalRoot>
    );
}

function toggleGallery(channelId: string): void {
    if (!channelId) return;

    if (modalKey) {
        closeModal(modalKey);
        modalKey = null;
        setState({ mode: "closed", channelId: null, selectedStableId: null });
        return;
    }

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
            onCloseCallback: () => {
                if (isProcessingCloseCallback) return;

                isProcessingCloseCallback = true;
                modalKey = null;

                if (pendingFullscreen) {
                    const { items, selectedStableId, channelId: fsChannelId } = pendingFullscreen;
                    pendingFullscreen = null;
                    isOpeningFullscreen = false;

                    openFullscreenView(
                        items,
                        selectedStableId,
                        () => {
                            setState({ mode: "single", channelId: fsChannelId, selectedStableId });
                            setTimeout(() => {
                                modalKey = openModal(
                                    ErrorBoundary.wrap(modalProps => (
                                        <GalleryModal
                                            {...modalProps}
                                            channelId={fsChannelId}
                                            settings={settings.store}
                                        />
                                    ), { noop: true }),
                                    {
                                        onCloseCallback: () => {
                                            modalKey = null;
                                            setState({ mode: "closed", channelId: null, selectedStableId: null });
                                        }
                                    }
                                );
                            }, 50);
                        }
                    );
                } else {
                    setState({ mode: "closed", channelId: null, selectedStableId: null });
                }
                isProcessingCloseCallback = false;
            }
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
    authors: [EquicordDevs.benjii],
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
        cacheByChannel.clear();
        if (modalKey) {
            closeModal(modalKey);
            modalKey = null;
        }
        setState({ mode: "closed", channelId: null, selectedStableId: null });
        stateListeners.clear();
        isOpeningFullscreen = false;
        pendingFullscreen = null;
        isProcessingCloseCallback = false;
    }
});
