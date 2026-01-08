/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChannelStore, NavigationRouter, React, useCallback, useEffect, useMemo, useState } from "@webpack/common";

import { log } from "../utils/logging";
import type { GalleryItem } from "../utils/media";

function preloadImage(url?: string): void {
    if (url) new Image().src = url;
}

function preloadVideo(url?: string): void {
    if (!url) return;
    // Create a video element to start buffering
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = url;
}

export function SingleView(props: {
    items: GalleryItem[];
    selectedStableId: string;
    cache: { failedIds: Set<string>; };
    onClose(): void;
    onChange(stableId: string): void;
    onMarkFailed(stableId: string): void;
}) {
    const { items, selectedStableId, cache, onClose, onChange, onMarkFailed } = props;
    const [videoFailed, setVideoFailed] = useState(false);
    const [imageFailed, setImageFailed] = useState(false);

    const selectedIndex = useMemo(() => {
        if (!items || items.length === 0 || !selectedStableId) return -1;
        const idx = items.findIndex(item => item && item.stableId === selectedStableId);
        log.debug("render", "SingleView selected index", {
            selectedIndex: idx,
            totalItems: items.length,
            selectedStableId
        });
        return idx;
    }, [items, selectedStableId]);

    // Auto-advance to next valid image if current one fails or is invalid
    useEffect(() => {
        if (selectedIndex < 0 || selectedIndex >= items.length) {
            const nextValid = items.find(item => item && item.stableId && !cache.failedIds.has(item.stableId));
            if (nextValid && nextValid.stableId !== selectedStableId) {
                onChange(nextValid.stableId);
            } else if (!nextValid) {
                onClose();
            }
            return;
        }

        const item = items[selectedIndex];
        if (!item || !item.url || cache.failedIds.has(item.stableId)) {
            const nextValid = items.find((it, idx) => idx > selectedIndex && it && it.stableId && !cache.failedIds.has(it.stableId));
            if (nextValid && nextValid.stableId !== selectedStableId) {
                onChange(nextValid.stableId);
            } else {
                const prevValid = items.slice(0, selectedIndex).reverse().find(it => it && it.stableId && !cache.failedIds.has(it.stableId));
                if (prevValid && prevValid.stableId !== selectedStableId) {
                    onChange(prevValid.stableId);
                } else if (!prevValid && !nextValid) {
                    onClose();
                }
            }
        }
    }, [selectedIndex, items, selectedStableId, cache.failedIds, onChange, onClose]);

    if (selectedIndex < 0 || selectedIndex >= items.length) return null;

    const item = items[selectedIndex];
    if (!item || !item.url || cache.failedIds.has(item.stableId)) return null;

    // Find next/prev valid items (skip failed ones)
    const findNextValid = (startIndex: number, direction: 1 | -1): GalleryItem | null => {
        for (let i = startIndex + direction; i >= 0 && i < items.length; i += direction) {
            const it = items[i];
            if (it && it.stableId && it.url && !cache.failedIds.has(it.stableId)) {
                return it;
            }
        }
        return null;
    };

    const prevItem = findNextValid(selectedIndex, -1);
    const nextItem = findNextValid(selectedIndex, 1);
    const hasPrev = prevItem !== null;
    const hasNext = nextItem !== null;
    const prevStableId = prevItem?.stableId ?? null;
    const nextStableId = nextItem?.stableId ?? null;

    // Keyboard navigation
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            log.debug("render", "SingleView key pressed", { key: e.key });
            if (e.key === "Escape") {
                e.preventDefault();
                onClose();
            } else if (e.key === "Enter" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
                // Jump to message in chat
                if (item && item.messageId && item.channelId) {
                    e.preventDefault();
                    e.stopPropagation();

                    // Get guild ID from channel
                    const channel = ChannelStore.getChannel(item.channelId);
                    const guildId = channel?.guild_id ?? "@me";

                    // Jump to message
                    const url = `/channels/${guildId}/${item.channelId}/${item.messageId}`;
                    NavigationRouter.transitionTo(url);

                    // Close the single view
                    onClose();
                }
            } else if (e.key === "ArrowLeft" && hasPrev && prevStableId) {
                e.preventDefault();
                onChange(prevStableId);
            } else if (e.key === "ArrowRight" && hasNext && nextStableId) {
                e.preventDefault();
                onChange(nextStableId);
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [hasPrev, hasNext, prevStableId, nextStableId, onClose, onChange, item]);

    // Reset failed states when item changes
    useEffect(() => {
        setVideoFailed(false);
        setImageFailed(false);
    }, [selectedStableId]);

    // Preload adjacent items
    useEffect(() => {
        if (!items || items.length === 0) return;

        // Preload previous item
        if (prevItem) {
            const url = prevItem.proxyUrl || prevItem.url;
            if (prevItem.isVideo) {
                preloadVideo(url);
            } else {
                preloadImage(url);
            }
        }

        // Preload next item
        if (nextItem) {
            const url = nextItem.proxyUrl || nextItem.url;
            if (nextItem.isVideo) {
                preloadVideo(url);
            } else {
                preloadImage(url);
            }
        }
    }, [prevItem, nextItem]);

    const handlePrev = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (hasPrev && prevStableId) {
            onChange(prevStableId);
        }
    }, [hasPrev, prevStableId, onChange]);

    const handleNext = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (hasNext && nextStableId) {
            onChange(nextStableId);
        }
    }, [hasNext, nextStableId, onChange]);

    const { isVideo, isAnimated, isEmbed, embedUrl } = item;

    return (
        <div className="vc-gallery-lightbox vc-gallery-lightbox-large">
            <div className="vc-gallery-lightbox-content">
                {isEmbed && embedUrl ? (
                    <div className="vc-gallery-embed-container vc-gallery-embed-large">
                        {embedUrl.includes("youtube.com") || embedUrl.includes("youtu.be") ? (
                            <iframe
                                src={embedUrl.replace("youtu.be/", "youtube.com/embed/").replace("watch?v=", "embed/")}
                                className="vc-gallery-embed-iframe"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            />
                        ) : embedUrl.includes("vimeo.com") ? (
                            <iframe
                                src={`https://player.vimeo.com/video/${embedUrl.split("/").pop()}`}
                                className="vc-gallery-embed-iframe"
                                allow="autoplay; fullscreen; picture-in-picture"
                                allowFullScreen
                            />
                        ) : (
                            <div className="vc-gallery-embed-fallback">
                                <div className="vc-gallery-embed-placeholder">
                                    <p>Video embed</p>
                                    <a href={embedUrl} target="_blank" rel="noopener noreferrer" className="vc-gallery-embed-link">
                                        Open in browser
                                    </a>
                                </div>
                            </div>
                        )}
                    </div>
                ) : isVideo && !videoFailed ? (
                    <video
                        key={item.stableId}
                        src={item.proxyUrl || item.url}
                        className="vc-gallery-lightbox-video"
                        controls
                        autoPlay
                        loop={isAnimated}
                        preload="auto"
                        onError={() => {
                            setVideoFailed(true);
                            onMarkFailed(item.stableId);
                            if (nextStableId) {
                                setTimeout(() => onChange(nextStableId), 100);
                            } else if (prevStableId) {
                                setTimeout(() => onChange(prevStableId), 100);
                            } else {
                                setTimeout(() => onClose(), 100);
                            }
                        }}
                    />
                ) : (
                    <img
                        key={item.stableId}
                        src={item.proxyUrl || item.url}
                        alt={item.filename ?? "Image"}
                        className="vc-gallery-lightbox-image"
                        onError={() => {
                            setImageFailed(true);
                            onMarkFailed(item.stableId);
                            if (nextStableId) {
                                setTimeout(() => onChange(nextStableId), 100);
                            } else if (prevStableId) {
                                setTimeout(() => onChange(prevStableId), 100);
                            } else {
                                setTimeout(() => onClose(), 100);
                            }
                        }}
                    />
                )}
            </div>

            <button
                disabled={!hasPrev}
                onClick={handlePrev}
                className="vc-gallery-nav-button vc-gallery-nav-button-left"
            >
                <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="vc-gallery-nav-icon"
                >
                    <path
                        d="M15.41 7.41L14 6L8 12L14 18L15.41 16.59L10.83 12L15.41 7.41Z"
                        fill="currentColor"
                    />
                </svg>
            </button>
            <button
                disabled={!hasNext}
                onClick={handleNext}
                className="vc-gallery-nav-button vc-gallery-nav-button-right"
            >
                <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="vc-gallery-nav-icon"
                >
                    <path
                        d="M8.59 16.59L10 18L16 12L10 6L8.59 7.41L13.17 12L8.59 16.59Z"
                        fill="currentColor"
                    />
                </svg>
            </button>
        </div>
    );
}
