/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findByPropsLazy } from "@webpack";
import { React, useCallback, useEffect, useMemo, useState } from "@webpack/common";

import type { GalleryItem } from "../utils/media";

const jumper: any = findByPropsLazy("jumpToMessage");

function preload(url?: string): void {
    if (url) new Image().src = url;
}

export function SingleView(props: {
    items: GalleryItem[];
    selectedStableId: string;
    channelId: string;
    cache: { failedIds: Set<string> };
    onClose(): void;
    onChange(stableId: string): void;
    onOpenMessage(): void;
    onMarkFailed(stableId: string): void;
}) {
    const { items, selectedStableId, channelId, cache, onClose, onChange, onOpenMessage, onMarkFailed } = props;
    const [videoFailed, setVideoFailed] = useState(false);
    const [imageFailed, setImageFailed] = useState(false);

    const selectedIndex = useMemo(() => {
        if (!items || items.length === 0 || !selectedStableId) return -1;
        return items.findIndex(item => item && item.stableId === selectedStableId);
    }, [items, selectedStableId]);

    // Auto-advance to next valid image if current one fails or is invalid
    useEffect(() => {
        if (selectedIndex < 0 || selectedIndex >= items.length) {
            // Find next valid item
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
            // Current item is invalid, find next valid
            const nextValid = items.find((it, idx) => idx > selectedIndex && it && it.stableId && !cache.failedIds.has(it.stableId));
            if (nextValid && nextValid.stableId !== selectedStableId) {
                onChange(nextValid.stableId);
            } else {
                // Try previous
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

    const handleJump = useCallback(() => {
        if (!item || !item.messageId) return;
        try {
            jumper.jumpToMessage({
                channelId,
                messageId: item.messageId,
                flash: true,
                jumpType: "INSTANT"
            });
        } finally {
            onOpenMessage();
        }
    }, [item, channelId, onOpenMessage]);

    // Keyboard navigation
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                onClose();
            } else if (e.key === "ArrowLeft" && hasPrev && prevStableId) {
                e.preventDefault();
                onChange(prevStableId);
            } else if (e.key === "ArrowRight" && hasNext && nextStableId) {
                e.preventDefault();
                onChange(nextStableId);
            } else if (e.key === "Enter") {
                e.preventDefault();
                handleJump();
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [hasPrev, hasNext, prevStableId, nextStableId, onClose, onChange, handleJump]);

    useEffect(() => {
        if (!items || items.length === 0) return;
        setVideoFailed(false);
        setImageFailed(false);
        
        // Find next valid items for preloading
        if (hasPrev) {
            for (let i = selectedIndex - 1; i >= 0; i--) {
                const prevItem = items[i];
                if (prevItem && prevItem.url && !cache.failedIds.has(prevItem.stableId)) {
                    preload(prevItem.url);
                    break;
                }
            }
        }
        if (hasNext) {
            for (let i = selectedIndex + 1; i < items.length; i++) {
                const nextItem = items[i];
                if (nextItem && nextItem.url && !cache.failedIds.has(nextItem.stableId)) {
                    preload(nextItem.url);
                    break;
                }
            }
        }
    }, [items, selectedIndex, hasPrev, hasNext, cache.failedIds]);

    const handlePrev = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (hasPrev && prevStableId) {
            onChange(prevStableId);
        }
    };

    const handleNext = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (hasNext && nextStableId) {
            onChange(nextStableId);
        }
    };

    const { isVideo, isAnimated, isEmbed, embedUrl } = item;

    return (
        <div className="vc-gallery-lightbox">
            <div className="vc-gallery-lightbox-content">
                {isEmbed && embedUrl ? (
                    <div className="vc-gallery-embed-container">
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
                        src={item.proxyUrl || item.url}
                        className="vc-gallery-lightbox-image"
                        controls
                        autoPlay
                        loop={isAnimated}
                        onError={() => {
                            setVideoFailed(true);
                            onMarkFailed(item.stableId);
                            // Auto-advance to next valid image
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
                        src={item.proxyUrl || item.url}
                        alt={item.filename ?? "Image"}
                        className="vc-gallery-lightbox-image"
                        onError={() => {
                            setImageFailed(true);
                            onMarkFailed(item.stableId);
                            // Auto-advance to next valid image
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
