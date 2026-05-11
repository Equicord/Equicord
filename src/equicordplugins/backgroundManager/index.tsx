/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { HeaderBarButton } from "@api/HeaderBar";
import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { Switch } from "@components/Switch";
import { EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { classes } from "@utils/misc";
import definePlugin, { OptionType } from "@utils/types";
import { chooseFile } from "@utils/web";
import type { Message } from "@vencord/discord-types";
import { Alerts, Dialog, Menu, Popout, Toasts, Tooltip, useCallback, useEffect, useRef, useState } from "@webpack/common";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, SVGProps } from "react";

import {
    addMediaBlob,
    clearMediaLibrary,
    ensureMediaItemsLoaded,
    getLegacySelectedMediaId,
    getMediaItems,
    getPersistedActiveMediaId,
    type MediaItem,
    releaseMediaLibrary,
    removeMediaItem,
    setPersistedActiveMediaId,
    subscribeToMediaItems
} from "./store";
import managedStyle from "./styles.css?managed";

const cl = classNameFactory("vc-bgmanager-");
const DEFAULT_SLIDESHOW_INTERVAL_MINUTES = 5;
const MAX_SLIDESHOW_INTERVAL_MINUTES = 60;
const CURRENT_SETTINGS_MIGRATION_VERSION = 2;
const MAX_DIMMING = 80;
const MAX_BLUR = 10;
const renderPercent = (value: number) => `${Math.round(value)}%`;
const backgroundHeaderStyle = {
    "--__header-bar-background": "transparent",
    "--background-gradient-lower": "transparent"
} as CSSProperties;

interface BackgroundManagerSettingsStore {
    activeMediaId: string;
    blur: number;
    contrast: number;
    dimming: number;
    enableSlideshow: boolean;
    enableTransition: boolean;
    grayscale: number;
    migrationVersion: number;
    saturate: number;
    shuffleSlideshow: boolean;
    slideshowInterval: number;
    transitionDuration: number;
}

interface LegacyBackgroundManagerSettingsStore extends BackgroundManagerSettingsStore {
    activeId?: unknown;
}

interface ImageContextProps {
    src?: string;
}

type MessageContextTarget =
    Pick<HTMLElement, "dataset" | "tagName">
    & Partial<Pick<HTMLAnchorElement, "href">>
    & Partial<Pick<HTMLMediaElement, "currentSrc" | "src">>;

interface MessageContextProps {
    mediaItem?: {
        contentType?: string;
        url?: string;
    };
    message?: Message;
    target?: MessageContextTarget;
}

interface RenderedLayer {
    key: number;
    media: MediaItem;
    visible: boolean;
}

const settings = definePluginSettings({
    activeMediaId: {
        type: OptionType.STRING,
        hidden: true,
        description: "",
        default: ""
    },
    migrationVersion: {
        type: OptionType.NUMBER,
        hidden: true,
        description: "",
        default: 0
    },
    enableSlideshow: {
        type: OptionType.BOOLEAN,
        description: "Auto-cycle through backgrounds.",
        default: false
    },
    slideshowInterval: {
        type: OptionType.SLIDER,
        description: "Slideshow interval in minutes.",
        default: DEFAULT_SLIDESHOW_INTERVAL_MINUTES,
        hidden: () => !settings.store.enableSlideshow,
        markers: [1, 2, 5, 10, 15, 20, 30, 45, 60],
        stickToMarkers: false,
        componentProps: {
            keyboardStep: 1,
            onValueRender: (value: number) => `${Math.round(value)} min`
        }
    },
    shuffleSlideshow: {
        type: OptionType.BOOLEAN,
        description: "Randomize slideshow order.",
        default: true,
        hidden: () => !settings.store.enableSlideshow
    },
    enableTransition: {
        type: OptionType.BOOLEAN,
        description: "Enable smooth crossfade transitions between backgrounds.",
        default: true,
        hidden: () => !settings.store.enableSlideshow
    },
    transitionDuration: {
        type: OptionType.NUMBER,
        description: "Transition duration in milliseconds.",
        default: 1000,
        hidden: () => !settings.store.enableSlideshow
    },
    dimming: {
        type: OptionType.SLIDER,
        description: "Background overlay opacity (%).",
        default: 0,
        markers: [0, 5, 10, 15, 20, 30, 40, 50, 60, 70, 80],
        stickToMarkers: false,
        componentProps: {
            keyboardStep: 1,
            onValueRender: renderPercent
        }
    },
    blur: {
        type: OptionType.SLIDER,
        description: "Background blur (px).",
        default: 0,
        markers: [0, 0.5, 1, 2, 3, 5, 7.5, 10],
        stickToMarkers: false,
        componentProps: {
            keyboardStep: 0.25,
            onValueRender: (value: number) => `${formatSettingNumber(value)}px`
        }
    },
    grayscale: {
        type: OptionType.SLIDER,
        description: "Grayscale filter (%).",
        default: 0,
        markers: [0, 25, 50, 75, 100],
        stickToMarkers: false,
        componentProps: {
            keyboardStep: 1,
            onValueRender: renderPercent
        }
    },
    saturate: {
        type: OptionType.SLIDER,
        description: "Saturation (%).",
        default: 100,
        markers: [0, 50, 100, 200, 300],
        stickToMarkers: false,
        componentProps: {
            keyboardStep: 1,
            onValueRender: renderPercent
        }
    },
    contrast: {
        type: OptionType.SLIDER,
        description: "Contrast (%).",
        default: 100,
        markers: [0, 50, 100, 200, 300],
        stickToMarkers: false,
        componentProps: {
            keyboardStep: 1,
            onValueRender: renderPercent
        }
    },
    clearDatabase: {
        type: OptionType.COMPONENT,
        description: "Delete all stored background media.",
        component: () => (
            <button
                className={cl("clear-button")}
                onClick={() => {
                    Alerts.show({
                        title: "Delete All Backgrounds",
                        body: "This will permanently delete all stored background media.",
                        confirmText: "Delete",
                        cancelText: "Cancel",
                        onConfirm: async () => {
                            await clearMediaLibrary();
                            await clearActiveMedia();
                            showSuccessToast("All backgrounds deleted");
                        }
                    });
                }}
            >
                Delete All Backgrounds
            </button>
        )
    }
});

function showSuccessToast(message: string) {
    Toasts.show({
        id: Toasts.genId(),
        message,
        type: Toasts.Type.SUCCESS
    });
}

function showFailureToast(message: string) {
    Toasts.show({
        id: Toasts.genId(),
        message,
        type: Toasts.Type.FAILURE
    });
}

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

function formatSize(bytes: number) {
    const units = ["B", "KiB", "MiB", "GiB"];
    let value = bytes;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex++;
    }

    return `${unitIndex > 0 ? value.toFixed(1) : String(value)} ${units[unitIndex]}`;
}

function formatIntervalMinutes(intervalMinutes: number) {
    const minutes = normalizeSlideshowIntervalMinutes(intervalMinutes);
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

function formatSettingNumber(value: number) {
    return Number.isInteger(value)
        ? String(value)
        : value.toFixed(2).replace(/\.?0+$/, "");
}

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function normalizeSlideshowIntervalMinutes(value: number) {
    if (!Number.isFinite(value)) return DEFAULT_SLIDESHOW_INTERVAL_MINUTES;
    return clamp(Math.round(value), 1, MAX_SLIDESHOW_INTERVAL_MINUTES);
}

function normalizeDimming(value: number) {
    if (!Number.isFinite(value)) return 0;
    return clamp(value, 0, MAX_DIMMING);
}

function normalizeBlur(value: number) {
    if (!Number.isFinite(value)) return 0;
    return clamp(value, 0, MAX_BLUR);
}

function getSettingsStore() {
    return settings.store as BackgroundManagerSettingsStore;
}

function getLegacySettingsStore() {
    return settings.store as LegacyBackgroundManagerSettingsStore;
}

function syncActiveMediaId(id: string) {
    getSettingsStore().activeMediaId = id;
}

function repairStoredSettings() {
    const store = getSettingsStore();

    const normalizedSlideshowInterval = normalizeSlideshowIntervalMinutes(store.slideshowInterval);
    if (normalizedSlideshowInterval !== store.slideshowInterval) {
        store.slideshowInterval = normalizedSlideshowInterval;
    }

    const normalizedDimming = normalizeDimming(store.dimming);
    if (normalizedDimming !== store.dimming) {
        store.dimming = normalizedDimming;
    }

    const normalizedBlur = normalizeBlur(store.blur);
    if (normalizedBlur !== store.blur) {
        store.blur = normalizedBlur;
    }
}

function migrateStoredSettings() {
    const store = getLegacySettingsStore();
    if (store.migrationVersion >= CURRENT_SETTINGS_MIGRATION_VERSION) return;

    if (store.migrationVersion < 1 && store.slideshowInterval > MAX_SLIDESHOW_INTERVAL_MINUTES) {
        store.slideshowInterval = normalizeSlideshowIntervalMinutes(store.slideshowInterval / 60000);
    }

    if (store.migrationVersion < 2) {
        const legacyActiveMediaId = typeof store.activeId === "string" ? store.activeId : "";
        const migratedActiveMediaId = getValidActiveMediaId(getMediaItems(), legacyActiveMediaId);
        if (!store.activeMediaId && migratedActiveMediaId) {
            store.activeMediaId = migratedActiveMediaId;
        }

        delete store.activeId;
    }

    store.migrationVersion = CURRENT_SETTINGS_MIGRATION_VERSION;
}

function normalizeFetchedBlob(blob: Blob, contentType: string | null) {
    if (!contentType || blob.type === contentType) return blob;
    return blob.slice(0, blob.size, contentType);
}

function isValidMediaId(id: string, items = getMediaItems()) {
    return id.length > 0 && items.some(media => media.id === id);
}

function getValidActiveMediaId(items = getMediaItems(), id = getSettingsStore().activeMediaId) {
    return isValidMediaId(id, items) ? id : "";
}

async function restoreSelectedMediaFromSettings() {
    const items = getMediaItems();
    const activeMediaId = getValidActiveMediaId(items);
    if (activeMediaId) {
        await selectMediaById(activeMediaId);
        return;
    }

    const persistedActiveMediaId = await getPersistedActiveMediaId();
    if (isValidMediaId(persistedActiveMediaId, items)) {
        await selectMediaById(persistedActiveMediaId);
        return;
    }

    const legacySelectedMediaId = getLegacySelectedMediaId();
    if (isValidMediaId(legacySelectedMediaId, items)) {
        await selectMediaById(legacySelectedMediaId);
        return;
    }
}

async function selectMediaById(id: string) {
    syncActiveMediaId(id);
    await setPersistedActiveMediaId(id);
}

async function clearActiveMedia() {
    syncActiveMediaId("");
    await setPersistedActiveMediaId("");
}

async function removeMediaById(id: string) {
    const mediaItems = getMediaItems();
    const removedIndex = mediaItems.findIndex(media => media.id === id);
    const wasActive = getValidActiveMediaId(mediaItems) === id;

    const removed = await removeMediaItem(id);
    if (!removed || !wasActive) return;

    const remaining = getMediaItems();
    const fallbackMedia = remaining[removedIndex] ?? remaining[removedIndex - 1] ?? remaining[0];
    if (fallbackMedia) {
        await selectMediaById(fallbackMedia.id);
    } else {
        await clearActiveMedia();
    }
}

async function addMediaFromBlob(blob: Blob) {
    const media = await addMediaBlob(blob);
    if (!media) {
        showFailureToast("Only images, GIFs, and supported videos can be used as backgrounds");
        return null;
    }

    return media;
}

async function fetchAndAddMedia(src: string) {
    try {
        const url = new URL(src);
        const response = await fetch(url.toString(), { mode: "cors" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() ?? null;
        const blob = normalizeFetchedBlob(await response.blob(), contentType);

        const media = await addMediaFromBlob(blob);
        if (!media) return;

        showSuccessToast("Added to Background Manager");
    } catch (error) {
        showFailureToast(`Failed to add background media: ${getErrorMessage(error)}`);
    }
}

async function advanceSlideshow(items = getMediaItems(), activeMediaId = getValidActiveMediaId(items), shuffle = settings.store.shuffleSlideshow) {
    if (items.length < 2) return;

    const currentIndex = items.findIndex(media => media.id === activeMediaId);
    let nextIndex = 0;

    if (shuffle) {
        let attempts = 0;
        do {
            nextIndex = Math.floor(Math.random() * items.length);
        } while (items.length > 1 && nextIndex === currentIndex && attempts++ < 25);
    } else if (currentIndex >= 0) {
        nextIndex = (currentIndex + 1) % items.length;
    }

    await selectMediaById(items[nextIndex].id);
}

function useMediaLibrary() {
    const [items, setItems] = useState<MediaItem[]>(() => getMediaItems());

    useEffect(() => {
        const update = () => setItems([...getMediaItems()]);
        const unsubscribe = subscribeToMediaItems(update);

        update();
        void ensureMediaItemsLoaded().then(update);

        return unsubscribe;
    }, []);

    return items;
}

function useRenderedLayers(activeMedia: MediaItem | null, transitionDuration: number, transitionsEnabled: boolean) {
    const [layers, setLayers] = useState<RenderedLayer[]>(() => activeMedia ? [{ key: 0, media: activeMedia, visible: true }] : []);
    const nextKeyRef = useRef(1);

    useEffect(() => {
        if (!activeMedia) {
            setLayers([]);
            return;
        }

        setLayers(previousLayers => {
            const currentLayer = previousLayers[previousLayers.length - 1];
            if (currentLayer?.media.id === activeMedia.id) {
                return previousLayers.map((layer, index) => ({
                    ...layer,
                    visible: index === previousLayers.length - 1
                }));
            }

            const nextLayer: RenderedLayer = {
                key: nextKeyRef.current++,
                media: activeMedia,
                visible: true
            };

            if (!transitionsEnabled || transitionDuration <= 0 || previousLayers.length === 0) {
                return [nextLayer];
            }

            const previousLayer = previousLayers[previousLayers.length - 1];
            return [
                { ...previousLayer, visible: false },
                nextLayer
            ];
        });
    }, [activeMedia, transitionDuration, transitionsEnabled]);

    useEffect(() => {
        if (!transitionsEnabled || transitionDuration <= 0 || layers.length < 2) return;

        const timeout = window.setTimeout(() => {
            setLayers(previousLayers => previousLayers.slice(-1));
        }, transitionDuration);

        return () => window.clearTimeout(timeout);
    }, [layers, transitionDuration, transitionsEnabled]);

    return layers;
}

function BackgroundLayerRoot() {
    const items = useMediaLibrary();
    const store = settings.use();
    const {
        activeMediaId: storedActiveMediaId,
        blur,
        contrast,
        dimming,
        enableSlideshow,
        enableTransition,
        grayscale,
        saturate,
        shuffleSlideshow,
        slideshowInterval,
        transitionDuration
    } = store;

    const blurAmount = normalizeBlur(blur);
    const dimmingAmount = normalizeDimming(dimming);
    const slideshowIntervalMinutes = normalizeSlideshowIntervalMinutes(slideshowInterval);
    const activeMediaId = getValidActiveMediaId(items, storedActiveMediaId);
    const activeMedia = items.find(media => media.id === activeMediaId) ?? null;
    const slideshowStateRef = useRef({ items, activeMediaId, shuffleSlideshow });

    useEffect(() => {
        slideshowStateRef.current = { items, activeMediaId, shuffleSlideshow };
    }, [activeMediaId, items, shuffleSlideshow]);

    useEffect(() => {
        if (!enableSlideshow || items.length < 2 || !activeMediaId) return;

        const interval = window.setInterval(() => {
            const latest = slideshowStateRef.current;
            void advanceSlideshow(latest.items, latest.activeMediaId, latest.shuffleSlideshow);
        }, slideshowIntervalMinutes * 60 * 1000);

        return () => window.clearInterval(interval);
    }, [activeMediaId, enableSlideshow, items.length, slideshowIntervalMinutes]);

    const layers = useRenderedLayers(
        activeMedia,
        transitionDuration,
        enableTransition
    );

    if (layers.length === 0) return null;

    const filterParts = [
        `grayscale(${grayscale}%)`,
        `contrast(${contrast}%)`,
        `saturate(${saturate}%)`
    ];

    if (blurAmount > 0) {
        filterParts.push(`blur(${blurAmount}px)`);
    }

    const style = {
        "--vc-bgmanager-transition-ms": `${enableTransition ? transitionDuration : 0}ms`,
        "--vc-bgmanager-filter": filterParts.join(" "),
        "--vc-bgmanager-dimming": String(dimmingAmount / 100)
    } as CSSProperties;

    return (
        <div className={cl("root")} style={style} aria-hidden="true">
            {layers.map(layer => (
                <div
                    key={layer.key}
                    className={classes(cl("layer"), layer.visible && cl("layer-visible"))}
                >
                    {layer.media.kind === "image" ? (
                        <img className={cl("media")} src={layer.media.src} alt="" draggable={false} />
                    ) : (
                        <video
                            className={cl("media")}
                            src={layer.media.src}
                            autoPlay
                            loop
                            muted
                            playsInline
                            preload="auto"
                        />
                    )}
                    {dimmingAmount > 0 && <div className={cl("overlay")} />}
                </div>
            ))}
        </div>
    );
}

const SafeBackgroundLayerRoot = ErrorBoundary.wrap(BackgroundLayerRoot, { noop: true });

function GalleryIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg {...props} viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 4v12H8V4zm0-2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2m-8.5 9.67 1.69 2.26 2.48-3.1L19 15H9zM2 6v14c0 1.1.9 2 2 2h14v-2H4V6z" />
        </svg>
    );
}

function SvgIcon({ d, size = 24 }: { d: string; size?: number; }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
            <path d={d} />
        </svg>
    );
}

const ICONS = {
    upload: "M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2m0 12H4V6h5.17l2 2H20zM9.41 14.42 11 12.84V17h2v-4.16l1.59 1.59L16 13.01 12.01 9 8 13.01z",
    remove: "M22 8h-8v-2h8v2zM19 10H12V5H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2zM5 19l3-4 2 3 3-4 4 5H5z",
    delete: "M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
    next: "M5.7 6.71c-.39.39-.39 1.02 0 1.41L9.58 12 5.7 15.88c-.39.39-.39 1.02 0 1.41.39.39 1.02.39 1.41 0l4.59-4.59c.39-.39.39-1.02 0-1.41L7.12 6.71c-.39-.39-1.03-.39-1.42 0M12.29 6.71c-.39.39-.39 1.02 0 1.41L16.17 12l-3.88 3.88c-.39.39-.39 1.02 0 1.41.39.39 1.02.39 1.41 0l4.59-4.59c.39-.39.39-1.02 0-1.41L13.7 6.7c-.38-.38-1.02-.38-1.41.01"
};

function MediaThumbnail({ media, selected }: { media: MediaItem; selected: boolean; }) {
    const [loaded, setLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);

    const select = useCallback(() => {
        void selectMediaById(media.id);
    }, [media.id]);

    const onKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
        if (event.key !== "Enter" && event.key !== " ") return;

        event.preventDefault();
        select();
    }, [select]);

    return (
        <div
            className={classes(cl("card"), selected && cl("card-selected"))}
            role="button"
            tabIndex={0}
            onClick={select}
            onKeyDown={onKeyDown}
        >
            {!loaded && !hasError && <div className={cl("card-status")}>Loading...</div>}
            {hasError && <div className={cl("card-status")}>Failed to load</div>}
            {!hasError && media.kind === "image" && (
                <img
                    className={cl("card-media")}
                    src={media.src}
                    alt=""
                    draggable={false}
                    style={{ display: loaded ? "block" : "none" }}
                    onLoad={() => setLoaded(true)}
                    onError={() => setHasError(true)}
                />
            )}
            {!hasError && media.kind === "video" && (
                <video
                    className={cl("card-media")}
                    src={media.src}
                    muted
                    loop
                    playsInline
                    autoPlay
                    preload="metadata"
                    style={{ display: loaded ? "block" : "none" }}
                    onLoadedData={() => setLoaded(true)}
                    onError={() => setHasError(true)}
                />
            )}
            <div className={cl("card-meta")}>
                <span>{formatSize(media.blob.size)}</span>
                <span>{media.width}x{media.height}</span>
            </div>
            <button
                className={cl("delete-button")}
                onClick={event => {
                    event.stopPropagation();
                    void removeMediaById(media.id);
                }}
            >
                <SvgIcon d={ICONS.delete} size={16} />
            </button>
        </div>
    );
}

function ManagerPopout() {
    const items = useMediaLibrary();
    const { enableSlideshow, slideshowInterval } = settings.use();
    const activeMediaId = getValidActiveMediaId(items);
    const totalSize = items.reduce((size, media) => size + media.blob.size, 0);

    const uploadMedia = useCallback(async () => {
        try {
            const file = await chooseFile("image/*,video/*");
            if (!file) return;

            const media = await addMediaFromBlob(file);
            if (!media) return;

            showSuccessToast("Added to Background Manager");
        } catch (error) {
            showFailureToast(`Failed to add background media: ${getErrorMessage(error)}`);
        }
    }, []);

    const toggleSlideshow = useCallback((enabled: boolean) => {
        settings.store.enableSlideshow = enabled;
        if (enabled && items.length > 0 && !activeMediaId) {
            void selectMediaById(items[0].id);
        }
    }, [activeMediaId, items]);

    return (
        <Dialog className={cl("popout")}>
            <div className={cl("popout-content")}>
                <div className={cl("title-row")}>
                    <span className={cl("title")}>Background Manager</span>
                    {items.length > 0 && <span className={cl("summary")}>Total: {formatSize(totalSize)}</span>}
                </div>

                <div className={cl("controls")}>
                    <div className={cl("slideshow-control")}>
                        <div className={cl("slideshow-meta")}>
                            <div className={cl("slideshow-label")}>Slideshow</div>
                            <div className={cl("slideshow-note")}>{formatIntervalMinutes(slideshowInterval)}</div>
                        </div>
                        <Switch checked={enableSlideshow} onChange={toggleSlideshow} />
                    </div>

                    <Tooltip text="Upload Background">
                        {tooltipProps => (
                            <button
                                {...tooltipProps}
                                className={classes(cl("icon-button"), cl("icon-button-upload"))}
                                onClick={uploadMedia}
                            >
                                <SvgIcon d={ICONS.upload} />
                            </button>
                        )}
                    </Tooltip>

                    <Tooltip text="Hide Background">
                        {tooltipProps => (
                            <button
                                {...tooltipProps}
                                className={classes(cl("icon-button"), cl("icon-button-remove"))}
                                onClick={() => {
                                    void clearActiveMedia();
                                }}
                            >
                                <SvgIcon d={ICONS.remove} />
                            </button>
                        )}
                    </Tooltip>
                </div>

                {enableSlideshow && items.length >= 2 && (
                    <div className={cl("info-row")}>
                        <span>Rotating every {formatIntervalMinutes(slideshowInterval)}</span>
                        <Tooltip text="Next Background">
                            {tooltipProps => (
                                <button
                                    {...tooltipProps}
                                    className={cl("icon-button")}
                                    onClick={() => {
                                        void advanceSlideshow(items, activeMediaId, settings.store.shuffleSlideshow);
                                    }}
                                >
                                    <SvgIcon d={ICONS.next} size={18} />
                                </button>
                            )}
                        </Tooltip>
                    </div>
                )}

                <div className={cl("grid")}>
                    {items.map(media => <MediaThumbnail key={media.id} media={media} selected={media.id === activeMediaId} />)}
                </div>
            </div>
        </Dialog>
    );
}

function BackgroundManagerHeaderButton() {
    const buttonRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);

    return (
        <Popout
            position="bottom"
            align="right"
            spacing={8}
            animation={Popout.Animation.NONE}
            shouldShow={open}
            targetElementRef={buttonRef}
            onRequestClose={() => setOpen(false)}
            renderPopout={() => <ErrorBoundary><ManagerPopout /></ErrorBoundary>}
        >
            {(_, { isShown }) => (
                <HeaderBarButton
                    ref={buttonRef}
                    icon={GalleryIcon}
                    tooltip={isShown ? null : "Background Manager"}
                    selected={isShown}
                    onClick={() => setOpen(current => !current)}
                />
            )}
        </Popout>
    );
}

const imageContextPatch: NavContextMenuPatchCallback = (children, { src }: ImageContextProps) => {
    if (!src) return;

    children.push(
        <Menu.MenuSeparator />,
        <Menu.MenuItem
            id="vc-bgmanager-add"
            label="Add to Background Manager"
            action={() => {
                void fetchAndAddMedia(src);
            }}
        />
    );
};

const messageContextPatch: NavContextMenuPatchCallback = (children, props: MessageContextProps) => {
    let src: string | undefined;

    if (props.mediaItem?.contentType?.startsWith("image/") || props.mediaItem?.contentType?.startsWith("video/")) {
        src = props.mediaItem.url;
    } else if (props.target?.tagName === "VIDEO") {
        src = props.target.currentSrc ?? props.target.src;
    } else if (props.target?.dataset?.role === "img") {
        src = props.message?.embeds.find(embed => embed.image?.url === props.target?.href)?.image?.proxyURL;
    }

    if (!src) return;

    children.push(
        <Menu.MenuSeparator />,
        <Menu.MenuItem
            id="vc-bgmanager-add"
            label="Add to Background Manager"
            action={() => {
                void fetchAndAddMedia(src);
            }}
        />
    );
};

export default definePlugin({
    name: "BackgroundManager",
    description: "Manage custom background images, GIFs, and videos with slideshow support.",
    authors: [EquicordDevs.benjii],
    requiresRestart: true,
    managedStyle,
    settings,

    patches: [
        {
            find: "name:\"Search\",renderLoader",
            replacement: {
                match: /className:(\i),innerClassName:(\i),toolbar:function/,
                replace: "className:$self.withBackgroundHeaderClass($1),style:$self.getBackgroundHeaderStyle(),innerClassName:$2,toolbar:function"
            }
        },
        {
            find: "renderChat(),this.renderSidebar()",
            replacement: [
                {
                    match: /("data-has-border":\i\.type!==\i\.\i\.GUILD_VOICE,className:)(\i\(\)\(\i\.\i,\{[^}]{0,60}\}\))(,children:\[)/,
                    replace: "$1$self.withBackgroundChatClass($2)$3"
                },
                {
                    match: /(className:)(\i\(\)\(\i\.\i,\{\[\i\.\i\]:\i===\i\.\i\.NO_CHAT\}\))(,children:\[this\.renderChat\(\),this\.renderSidebar\(\)\])/,
                    replace: "$1$self.withBackgroundChatContentClass($2)$3"
                }
            ]
        },
        {
            find: "content-inventory-feed",
            replacement: [
                {
                    match: /(id:`members-\$\{\i\.id\}`,setFocus:\i,isEnabled:\i,scrollToStart:\i,scrollToEnd:\i\}\);return\(0,\i\.jsx\)\(\i\.\i,\{value:\i,children:\(0,\i\.jsx\)\("div",\{className:)(\i\(\)\(\i\.\i,\i\))/,
                    replace: "$1$self.withBackgroundMembersClass($2)"
                },
                {
                    match: /("aside",\{className:)(\i\(\)\(\i\.\i,\i\.\i\))(,"aria-labelledby":\i,children:\(0,\i\.jsx\)\(\i\.\i,\{component:)/,
                    replace: "$1$self.withBackgroundMembersClass($2)$3"
                },
                {
                    match: /(ref:\i=>\{this\._list=\i,this\.props\.listRef\.current=\i,\i\.current=\i\?\.getScrollerNode\(\)\?\?null\},className:)(\i\(\)\(\i\.\i,\{\[\i\.\i\]:\i\.\i\}\))(,paddingTop:0,sectionHeight:\i,rowHeight:this\.getRowHeightComputer\(\),renderSection:this\.renderSection,renderRow:this\.renderRow)/,
                    replace: "$1$self.withBackgroundMembersClass($2)$3"
                }
            ]
        },
        {
            find: "#{intl::GUILDS_BAR_A11Y_LABEL}",
            replacement: {
                match: /("nav",\{className:)(\i\(\)\(\i\.\i,\i,\i,\{\[\i\.\i\]:\i\}\))(,"aria-label":\i\.intl\.string\(\i\.t#{intl::GUILDS_BAR_A11Y_LABEL}\))/,
                replace: "$1$self.withBackgroundGuildsClass($2)$3"
            }
        },
        {
            find: "CHANNEL_SIDEBAR_RESIZED,{width:",
            replacement: [
                {
                    match: /(className:)(\i\.\i)(,children:\[\(0,\i\.jsx\)\(\i,\{\}\),\(0,\i\.jsx\)\(\i,\{isSidebarOpen:)/,
                    replace: "$1$self.withBackgroundAppContentClass($2)$3"
                },
                {
                    match: /(className:)(\i\.\i)(,"data-collapsed":!1)/,
                    replace: "$1$self.withBackgroundPageClass($2)$3"
                },
                {
                    match: /(className:)(\i\.\i)(,themeOverride:)/,
                    replace: "$1$self.withBackgroundGuildsClass($2)$3"
                },
                {
                    match: /(className:)(\i\(\)\(\i\.\i,\i,\{\[\i\.\i\]:\i\.\i,\[\i\.\i\]:\i,\[\i\.\i\]:\i\}\))(,children:\[\i&&\(0,\i\.jsx\)\(\i\.\i,\{className:\i\.\i,themeOverride:)/,
                    replace: "$1$self.withBackgroundSidebarClass($2)$3"
                },
                {
                    match: /let (\i)=\{className:(\i\(\)\(\i\.\i,\{\[\i\.\i\]:!\i\}\))\};/,
                    replace: "let $1={className:$self.withBackgroundSidebarListClass($2)};"
                }
            ]
        },
        {
            find: "refresh-title-bar-small",
            replacement: [
                {
                    match: /(return\(0,\i\.jsxs\)\("div",\{className:)(\i\(\)\(\i\.\i,\{\[\i\.\i\]:\i\}\))(,children:\[\i,\i,\i\]\}\))/,
                    replace: "$1$self.withBackgroundSystemBarTrailingClass($2)$3"
                },
                {
                    match: /(className:)(\i\(\)\(\i\.\i,\i\))(,onDoubleClick:\i,children:\[\(0,\i\.jsx\)\("div",\{className:\i\.\i,onDoubleClick:\i,children:\i\}\))/,
                    replace: "$1$self.withBackgroundTitleBarClass($2)$3"
                }
            ]
        },
        {
            find: "this.renderArtisanalHack()",
            replacement: {
                match: /children:(\i)=>\(0,(\i)\.jsx\)\("div",\{className:(\i)\(\)\((\i)\.bg,\1\)\}\)/,
                replace: 'children:$1=>(0,$2.jsxs)("div",{className:$3()($4.bg,$1,$self.getBackgroundShellClass()),children:[$self.renderBackgroundLayer()]})'
            }
        }
    ],

    contextMenus: {
        "image-context": imageContextPatch,
        message: messageContextPatch
    },

    headerBarButton: {
        icon: GalleryIcon,
        render: BackgroundManagerHeaderButton
    },

    getBackgroundShellClass() {
        return cl("shell");
    },

    withBackgroundAppContentClass(className?: string) {
        return classes(className, cl("app-content"));
    },

    withBackgroundPageClass(className?: string) {
        return classes(className, cl("page"));
    },

    withBackgroundGuildsClass(className?: string) {
        return classes(className, cl("guilds"));
    },

    withBackgroundSidebarClass(className?: string) {
        return classes(className, cl("sidebar"));
    },

    withBackgroundSidebarListClass(className?: string) {
        return classes(className, cl("sidebar-list"));
    },

    withBackgroundHeaderClass(className?: string) {
        return classes(className, cl("header"));
    },

    getBackgroundHeaderStyle() {
        return backgroundHeaderStyle;
    },

    withBackgroundChatClass(className?: string) {
        return classes(className, cl("chat"));
    },

    withBackgroundChatContentClass(className?: string) {
        return classes(className, cl("chat-content"));
    },

    withBackgroundMembersClass(className?: string) {
        return classes(className, cl("members"));
    },

    withBackgroundSystemBarTrailingClass(className?: string) {
        return classes(className, cl("systembar-trailing"));
    },

    withBackgroundTitleBarClass(className?: string) {
        return classes(className, cl("titlebar"));
    },

    renderBackgroundLayer() {
        return <SafeBackgroundLayerRoot />;
    },

    async start() {
        await ensureMediaItemsLoaded();
        migrateStoredSettings();
        repairStoredSettings();
        await restoreSelectedMediaFromSettings();
    },

    stop() {
        releaseMediaLibrary(false);
    }
});
