/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button, React, ScrollerThin, TabBar, useCallback, useEffect, useMemo, useRef, useState } from "@webpack/common";

import type { GalleryItem } from "../utils/media";

const GAP = 10;
const PADDING = 14;
const MIN_THUMB = 120;
const MAX_THUMB = 150;
const LOAD_MORE_THRESHOLD = 600;

type FilterType = "newest" | "oldest" | "animated";

function withSizeParams(url: string, size: number): string {
    if (!url) return url;
    try {
        const u = new URL(url);
        // Don't add size params to URLs that don't support them
        // GitHub private images, YouTube, and other external services often don't support size params
        const hostname = u.hostname.toLowerCase();
        if (hostname.includes("githubusercontent.com") ||
            hostname.includes("youtube.com") ||
            hostname.includes("youtu.be") ||
            hostname.includes("vimeo.com") ||
            hostname.includes("instagram.com") ||
            hostname.includes("tenor.com")) {
            return url; // Return original URL without size params
        }
        u.searchParams.set("width", String(size));
        u.searchParams.set("height", String(size));
        return u.toString();
    } catch {
        return url;
    }
}

function getThumbUrl(item: GalleryItem, size: number): string {
    if (!item) return "";
    const url = item.proxyUrl ?? item.url;
    if (!url) return "";

    // Skip size params for animated/video media
    if (item.isAnimated || item.isVideo) {
        return url;
    }

    // Skip size params for YouTube URLs (including clips) - they don't support it
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
        return url;
    }

    return withSizeParams(url, size);
}

function getItemExt(item: GalleryItem): string {
    return item.filename?.toLowerCase().split(".").pop() ||
        item.url.toLowerCase().split(".").pop()?.split("?")[0] || "";
}

function filterItems(items: GalleryItem[], filter: FilterType): GalleryItem[] {
    const ANIMATED_EXTS = ["gif", "mp4", "webm", "mov", "m4v"];
    let filtered = [...items];

    if (filter === "animated") {
        filtered = filtered.filter(item => {
            if (item.isAnimated !== true) return false;
            const ext = getItemExt(item);
            return !ext || ANIMATED_EXTS.includes(ext);
        });
    } else if (filter === "newest" || filter === "oldest") {
        filtered = filtered.filter(item => {
            if (item.isAnimated === true) {
                const ext = getItemExt(item);
                if (ext && ANIMATED_EXTS.includes(ext)) return false;
            }
            return item.isAnimated !== true;
        });
        if (filter === "oldest") filtered = filtered.reverse();
    }

    return filtered;
}

export function GalleryView(props: {
    items: GalleryItem[];
    showCaptions: boolean;
    isLoading: boolean;
    hasMore: boolean;
    error: string | null;
    cache: { failedIds: Set<string> };
    onRetry(): void;
    onLoadMore(): void;
    onSelect(stableId: string): void;
    onMarkFailed(stableId: string): void;
}) {
    const { items, showCaptions, isLoading, hasMore, error, cache, onRetry, onLoadMore, onSelect, onMarkFailed } = props;

    const scrollRef = useRef<HTMLDivElement>(null);
    const scrollTopRef = useRef<number>(0);
    const rafIdRef = useRef<number | null>(null);
    const isSelectingRef = useRef<boolean>(false);
    const loadingTimeoutRef = useRef<number | null>(null);
    const lastScrollTimeRef = useRef<number>(0);
    const accelerationRef = useRef<number>(1);

    const [viewport, setViewport] = useState({ width: 800, height: 600 });
    const [filter, setFilter] = useState<FilterType>("newest");
    const [failedVideos, setFailedVideos] = useState<Set<string>>(new Set());

    // Initialize viewport
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;

        const updateViewport = () => {
            if (el.clientWidth > 0 && el.clientHeight > 0) {
                setViewport({
                    width: el.clientWidth,
                    height: el.clientHeight
                });
            }
        };

        updateViewport();
        window.addEventListener("resize", updateViewport);
        return () => window.removeEventListener("resize", updateViewport);
    }, []);

    // Calculate grid layout - ensure it's defined before use
    const gridLayout = useMemo(() => {
        const usableWidth = Math.max(1, viewport.width - PADDING * 2);
        const columns = Math.max(1, Math.floor((usableWidth + GAP) / (MIN_THUMB + GAP)));
        const cell = Math.max(MIN_THUMB, Math.min(MAX_THUMB, Math.floor((usableWidth - (columns - 1) * GAP) / columns)));
        const thumbSize = Math.max(128, Math.min(512, cell * 2));
        return { columns, cell, thumbSize };
    }, [viewport.width]);

    // Filter items based on selected filter
    const filteredItems = useMemo(() => {
        return filterItems(items, filter);
    }, [items, filter]);

    // Show all filtered items (infinite scroll loads more as needed)
    const itemsToShow = filteredItems;

    // Preload items near the bottom when scrolling
    useEffect(() => {
        const el = scrollRef.current;
        if (!el || filteredItems.length === 0) return;

        const checkAndPreload = () => {
            const { scrollTop, clientHeight, scrollHeight } = el;
            const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

            if (distanceFromBottom < clientHeight * 2) {
                const startIndex = Math.max(0, filteredItems.length - 50);
                const itemsToPreload = filteredItems.slice(startIndex);

                for (const item of itemsToPreload) {
                    if (item.url) {
                        const img = new Image();
                        img.src = getThumbUrl(item, gridLayout.thumbSize);
                    }
                }
            }
        };

        checkAndPreload();
        el.addEventListener("scroll", checkAndPreload, { passive: true });
        return () => el.removeEventListener("scroll", checkAndPreload);
    }, [filteredItems, gridLayout.thumbSize]);

    // Infinite scroll handler with acceleration
    const handleScroll = useCallback(() => {
        if (rafIdRef.current !== null) return;

        rafIdRef.current = requestAnimationFrame(() => {
            rafIdRef.current = null;
            const el = scrollRef.current;
            if (!el || el.clientHeight === 0 || el.scrollHeight === 0) return;

            const now = Date.now();
            const currentScrollTop = el.scrollTop;
            const lastScrollTop = scrollTopRef.current;
            const scrollDelta = Math.abs(currentScrollTop - lastScrollTop);
            const timeDelta = now - lastScrollTimeRef.current;

            // Calculate scroll velocity and acceleration
            if (timeDelta > 0 && timeDelta < 300) {
                const velocity = scrollDelta / timeDelta;

                // Increase acceleration if scrolling continues (velocity > threshold)
                if (velocity > 0.3) {
                    accelerationRef.current = Math.min(accelerationRef.current * 1.05, 2.5);
                } else {
                    accelerationRef.current = Math.max(accelerationRef.current * 0.98, 1);
                }

                // Apply smooth acceleration using requestAnimationFrame
                if (accelerationRef.current > 1 && scrollDelta > 5) {
                    const direction = currentScrollTop > lastScrollTop ? 1 : -1;
                    const additionalScroll = scrollDelta * (accelerationRef.current - 1) * 0.3;
                    requestAnimationFrame(() => {
                        if (el && el === scrollRef.current) {
                            const newScrollTop = el.scrollTop + (additionalScroll * direction);
                            el.scrollTop = Math.max(0, Math.min(newScrollTop, el.scrollHeight - el.clientHeight));
                        }
                    });
                }
            } else {
                accelerationRef.current = 1;
            }

            scrollTopRef.current = currentScrollTop;
            lastScrollTimeRef.current = now;

            const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;

            // Load more items when near the bottom
            if (distanceFromBottom < LOAD_MORE_THRESHOLD && distanceFromBottom >= 0 && !isLoading && hasMore) {
                if (loadingTimeoutRef.current) {
                    clearTimeout(loadingTimeoutRef.current);
                }
                loadingTimeoutRef.current = window.setTimeout(() => {
                    onLoadMore();
                }, 100);
            }
        });
    }, [hasMore, isLoading, onLoadMore]);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;

        el.addEventListener("scroll", handleScroll, { passive: true });
        const rafId = requestAnimationFrame(handleScroll);

        return () => {
            el.removeEventListener("scroll", handleScroll);
            if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
            }
            if (loadingTimeoutRef.current) {
                clearTimeout(loadingTimeoutRef.current);
                loadingTimeoutRef.current = null;
            }
            cancelAnimationFrame(rafId);
        };
    }, [handleScroll]);

    const handleThumbClick = useCallback((e: React.MouseEvent, stableId: string) => {
        e.preventDefault();
        e.stopPropagation();
        isSelectingRef.current = true;
        const el = scrollRef.current;
        if (el) scrollTopRef.current = el.scrollTop;
        onSelect(stableId);
        setTimeout(() => { isSelectingRef.current = false; }, 100);
    }, [onSelect]);

    const { columns, cell, thumbSize } = gridLayout;

    return (
        <div className="vc-gallery-view-container">
            <TabBar
                type="top"
                look="grey"
                selectedItem={filter}
                onItemSelect={id => setFilter(id as FilterType)}
                className="vc-gallery-tabbar"
            >
                <TabBar.Item id="newest">Newest</TabBar.Item>
                <TabBar.Item id="oldest">Oldest</TabBar.Item>
                <TabBar.Item id="animated">Animated</TabBar.Item>
            </TabBar>

            <ScrollerThin orientation="vertical" className="vc-channel-gallery-scroll">
                <div
                    ref={scrollRef}
                    className="vc-gallery-grid"
                    style={{
                        "--vc-gallery-columns": columns,
                        "--vc-gallery-cell": `${cell}px`
                    } as React.CSSProperties}
                >
                    {itemsToShow.map(item => {
                        if (!item?.stableId) return null;

                        return (
                            <button
                                key={item.stableId}
                                onClick={e => handleThumbClick(e, item.stableId)}
                                onMouseDown={e => e.preventDefault()}
                                className="vc-gallery-thumbnail-button"
                            >
                                <div className="vc-gallery-thumbnail-wrapper">
                                    {item.isVideo && !item.isEmbed && !failedVideos.has(item.stableId) ? (
                                        <video
                                            src={getThumbUrl(item, thumbSize)}
                                            className="vc-gallery-thumbnail-image"
                                            muted
                                            loop
                                            playsInline
                                        onError={() => {
                                            setFailedVideos(prev => new Set(prev).add(item.stableId));
                                            onMarkFailed(item.stableId);
                                        }}
                                        />
                                    ) : (
                                        <img
                                            src={getThumbUrl(item, thumbSize)}
                                            alt={item.filename ?? "Image"}
                                            loading="lazy"
                                            className="vc-gallery-thumbnail-image"
                                            onError={() => {
                                                onMarkFailed(item.stableId);
                                            }}
                                        />
                                    )}
                                </div>
                                {showCaptions && item.filename && (
                                    <div className="vc-gallery-caption" title={item.filename}>
                                        {item.filename}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>

                <div className="vc-gallery-status">
                    {error ? (
                        <div className="vc-gallery-status-error">
                            {error}{" "}
                            <Button size={Button.Sizes.SMALL} onClick={onRetry}>
                                Retry
                            </Button>
                        </div>
                    ) : isLoading ? (
                        <div className="vc-gallery-status-muted">Loading…</div>
                    ) : !filteredItems.length ? (
                        <div className="vc-gallery-status-muted">No {filter === "animated" ? "animated " : ""}images found yet</div>
                    ) : !hasMore && filteredItems.length > 0 ? (
                        <div className="vc-gallery-status-muted">End of history</div>
                    ) : null}
                </div>
            </ScrollerThin>

        </div>
    );
}
