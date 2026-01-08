/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button, React, ScrollerThin, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "@webpack/common";

import type { ManaSelectOption } from "../types/select";
import { log } from "../utils/logging";
import type { GalleryItem } from "../utils/media";
import { ManaSelect } from "./ManaSelect";

const GAP = 10;
const PADDING = 14;
const MIN_THUMB = 120;
const MAX_THUMB = 150;
const PAGE_SIZE = 50;

// Original filter type used by filterItems - preserved exactly
type FilterType = "newest" | "oldest" | "animated";

// Extended media filter type for new select control
type MediaFilterType = "images" | "gifs" | "videos" | "oldest" | "newest";

function withSizeParams(url: string, size: number): string {
    if (!url) return url;
    try {
        const u = new URL(url);
        const hostname = u.hostname.toLowerCase();
        if (hostname.includes("githubusercontent.com") ||
            hostname.includes("youtube.com") ||
            hostname.includes("youtu.be") ||
            hostname.includes("vimeo.com") ||
            hostname.includes("instagram.com") ||
            hostname.includes("tenor.com")) {
            return url;
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

    if (item.isAnimated || item.isVideo) {
        return url;
    }

    if (url.includes("youtube.com") || url.includes("youtu.be")) {
        return url;
    }

    return withSizeParams(url, size);
}

function getItemExt(item: GalleryItem): string {
    return item.filename?.toLowerCase().split(".").pop() ||
        item.url.toLowerCase().split(".").pop()?.split("?")[0] || "";
}

// Original filterItems function - preserved exactly
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

// Post-filter for media type (applied outside filterItems)
function applyMediaTypeFilter(items: GalleryItem[], mediaFilter: MediaFilterType, enableVideos: boolean): GalleryItem[] {
    let result = [...items];

    // Apply video setting first
    if (!enableVideos) {
        result = result.filter(item => !item.isVideo);
    }

    // Then apply media type filter
    switch (mediaFilter) {
        case "images":
            // Static images only (not animated, not videos)
            result = result.filter(item => !item.isVideo && !item.isAnimated);
            break;
        case "gifs":
            // All animated images (GIF, animated WebP, APNG, etc.) but not videos
            result = result.filter(item => item.isAnimated && !item.isVideo);
            break;
        case "videos":
            if (enableVideos) {
                result = result.filter(item => item.isVideo);
            } else {
                result = [];
            }
            break;
        case "oldest":
            result = result.reverse();
            break;
        case "newest":
        default:
            // No additional filtering needed
            break;
    }

    return result;
}

// Get username from item (prefer stored authorName, fallback to UserStore)
function getUsername(item: GalleryItem, userStore: any): string | null {
    // Prefer the stored authorName from message extraction
    if (item.authorName) return item.authorName;

    // Fallback to UserStore lookup
    if (!item.authorId) return null;
    try {
        const user = userStore?.getUser?.(item.authorId);
        if (user) {
            return user.globalName ?? user.username ?? null;
        }
    } catch {
        // Ignore errors
    }
    return null;
}

export function GalleryView(props: {
    items: GalleryItem[];
    showCaptions: boolean;
    isLoading: boolean;
    hasMore: boolean;
    error: string | null;
    cache: { failedIds: Set<string>; };
    enableVideos: boolean;
    userStore: any;
    onRetry(): void;
    onLoadMore(): void;
    onSelect(stableId: string, isVideo: boolean, filteredItems: GalleryItem[]): void;
    onMarkFailed(stableId: string): void;
    initialMediaFilter?: string;
    initialUsernameFilter?: string;
    initialCurrentPage?: number;
    initialScrollPosition?: number;
    onStateChange?: (state: { mediaFilter: string; usernameFilter: string; currentPage: number; scrollPosition: number; }) => void;
}) {
    const { items, showCaptions, isLoading, hasMore, error, cache, enableVideos, userStore, onRetry, onLoadMore, onSelect, onMarkFailed, initialMediaFilter, initialUsernameFilter, initialCurrentPage, initialScrollPosition, onStateChange } = props;

    const scrollRef = useRef<HTMLDivElement>(null);

    const [viewport, setViewport] = useState({ width: 800, height: 600 });
    const [mediaFilter, setMediaFilter] = useState<MediaFilterType>((initialMediaFilter as MediaFilterType) || "newest");
    const [usernameFilter, setUsernameFilter] = useState<string>(initialUsernameFilter || "all");
    const [failedVideos, setFailedVideos] = useState<Set<string>>(new Set());
    const [currentPage, setCurrentPage] = useState(initialCurrentPage || 1);

    // Initialize viewport with useLayoutEffect and ResizeObserver for better performance
    useLayoutEffect(() => {
        const el = scrollRef.current;
        if (!el) return;

        const updateViewport = () => {
            if (el.clientWidth > 0 && el.clientHeight > 0) {
                const newViewport = {
                    width: el.clientWidth,
                    height: el.clientHeight
                };
                log.debug("layout", "Viewport updated (useLayoutEffect)", newViewport);
                setViewport(newViewport);
            }
        };

        // Initial measurement
        updateViewport();
        log.debug("layout", "Viewport initialized", viewport);

        // Use ResizeObserver for better performance
        const resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                if (entry.contentBoxSize) {
                    const width = entry.contentBoxSize[0]?.inlineSize ?? entry.contentRect.width;
                    const height = entry.contentBoxSize[0]?.blockSize ?? entry.contentRect.height;
                    if (width > 0 && height > 0) {
                        log.debug("layout", "Viewport resized (ResizeObserver)", { width, height });
                        setViewport({ width, height });
                    }
                }
            }
        });

        resizeObserver.observe(el);

        // Fallback to window resize for older browsers
        window.addEventListener("resize", updateViewport);

        return () => {
            resizeObserver.disconnect();
            window.removeEventListener("resize", updateViewport);
        };
    }, []);

    // Restore scroll position when returning from fullscreen
    useEffect(() => {
        if (initialScrollPosition !== undefined && scrollRef.current) {
            scrollRef.current.scrollTop = initialScrollPosition;
        }
    }, []); // Only run once on mount

    // Notify parent of state changes (only when filters/page actually change, not on every render)
    const prevStateRef = React.useRef({ mediaFilter, usernameFilter, currentPage });
    const isInitialMount = React.useRef(true);

    useEffect(() => {
        // Skip on initial mount to avoid triggering state updates during initial render
        if (isInitialMount.current) {
            isInitialMount.current = false;
            prevStateRef.current = { mediaFilter, usernameFilter, currentPage };
            return;
        }

        if (onStateChange && scrollRef.current) {
            const hasChanged =
                prevStateRef.current.mediaFilter !== mediaFilter ||
                prevStateRef.current.usernameFilter !== usernameFilter ||
                prevStateRef.current.currentPage !== currentPage;

            if (hasChanged) {
                prevStateRef.current = { mediaFilter, usernameFilter, currentPage };
                // Use setTimeout to defer state update to avoid React error #185
                setTimeout(() => {
                    if (scrollRef.current && onStateChange) {
                        onStateChange({
                            mediaFilter,
                            usernameFilter,
                            currentPage,
                            scrollPosition: scrollRef.current.scrollTop
                        });
                    }
                }, 0);
            }
        }
    }, [mediaFilter, usernameFilter, currentPage]); // Removed onStateChange from deps to prevent loops

    // Calculate grid layout
    const gridLayout = useMemo(() => {
        const usableWidth = Math.max(1, viewport.width - PADDING * 2);
        const columns = Math.max(
            1,
            Math.floor((usableWidth + GAP) / (MIN_THUMB + GAP))
        );
        const cell = Math.max(
            MIN_THUMB,
            Math.min(
                MAX_THUMB,
                Math.floor((usableWidth - (columns - 1) * GAP) / columns)
            )
        );
        const thumbSize = Math.max(128, Math.min(512, cell * 2));

        log.debug("grid", "Grid calculation", {
            viewportWidth: viewport.width,
            usableWidth,
            columns,
            cell,
            thumbSize
        });

        return { columns, cell, thumbSize };
    }, [viewport.width]);

    // Build unique usernames list for filter (sorted A-Z, case-insensitive)
    // Only include users we can actually identify (skip unknowns)
    const usernameOptions = useMemo(() => {
        const userMap = new Map<string, { authorId: string; username: string; count: number; }>();

        // Filter items based on video setting when building username list
        const itemsForUsernames = enableVideos ? items : items.filter(item => !item.isVideo);

        for (const item of itemsForUsernames) {
            if (!item.authorId) continue;
            const existing = userMap.get(item.authorId);
            if (existing) {
                existing.count++;
            } else {
                const username = getUsername(item, userStore);
                // Only add users we can identify (skip null/unknown)
                if (username) {
                    userMap.set(item.authorId, { authorId: item.authorId, username, count: 1 });
                }
            }
        }

        const sorted = Array.from(userMap.values())
            .sort((a, b) => a.username.toLowerCase().localeCompare(b.username.toLowerCase()));

        const options: ManaSelectOption[] = [
            { id: "all", value: "all", label: "All users" },
            ...sorted.map(u => ({
                id: u.authorId,
                value: u.authorId,
                label: `${u.username} (${u.count})`
            }))
        ];

        return options;
    }, [items, userStore, enableVideos]);

    // Apply all filters
    const filteredItems = useMemo(() => {
        log.perfStart("filter-items");
        let result = [...items];

        // For media type filters (images, gifs, videos), skip filterItems and apply directly
        // For ordering filters (newest, oldest), use filterItems which handles sorting
        if (mediaFilter === "images" || mediaFilter === "gifs" || mediaFilter === "videos") {
            // Apply media type filter directly on all items
            result = applyMediaTypeFilter(result, mediaFilter, enableVideos);

            // Apply ordering (newest = default order, oldest = reversed)
            // Items are already in newest order from the API
        } else {
            // Use original filterItems for "newest" and "oldest" ordering
            const baseFilter: FilterType = mediaFilter === "oldest" ? "oldest" : "newest";
            result = filterItems(result, baseFilter);

            // Apply video setting filter
            if (!enableVideos) {
                result = result.filter(item => !item.isVideo);
            }
        }

        // Then apply username filter
        if (usernameFilter !== "all") {
            result = result.filter(item => item.authorId === usernameFilter);
        }

        log.perfEnd("filter-items", {
            originalCount: items.length,
            filteredCount: result.length,
            mediaFilter,
            usernameFilter
        });
        return result;
    }, [items, mediaFilter, usernameFilter, enableVideos]);

    // Calculate pagination - add 4 extra items to ensure full grid
    // Calculate how many items fit in the grid based on columns
    const { columns, cell, thumbSize } = gridLayout;
    const itemsPerRow = columns;
    const rowsPerPage = Math.ceil(PAGE_SIZE / itemsPerRow);
    const itemsNeededForFullGrid = rowsPerPage * itemsPerRow;
    const adjustedPageSize = itemsNeededForFullGrid + 4; // Add 4 extra to ensure full grid

    const totalPages = Math.max(1, Math.ceil(filteredItems.length / adjustedPageSize));
    const startIndex = (currentPage - 1) * adjustedPageSize;
    const endIndex = Math.min(startIndex + adjustedPageSize, filteredItems.length);
    const itemsToShow = filteredItems.slice(startIndex, endIndex);

    log.debug("render", "Rendering page", {
        currentPage,
        totalPages,
        startIndex,
        endIndex,
        itemsToShow: itemsToShow.length,
        totalFiltered: filteredItems.length
    });

    // Reset filter if videos selected but videos disabled
    useEffect(() => {
        if (mediaFilter === "videos" && !enableVideos) {
            setMediaFilter("newest");
        }
    }, [enableVideos, mediaFilter]);

    // Reset to first page and scroll position when filters change (but not on initial mount)
    const isInitialFilterMount = React.useRef(true);
    useEffect(() => {
        if (isInitialFilterMount.current) {
            isInitialFilterMount.current = false;
            return;
        }
        // Only reset if filters actually changed (not when restoring state)
        setCurrentPage(1);
        const el = scrollRef.current;
        if (el) {
            el.scrollTop = 0;
        }
    }, [mediaFilter, usernameFilter]);

    // Reset scroll position when page changes
    useEffect(() => {
        const el = scrollRef.current;
        if (el) {
            el.scrollTop = 0;
        }
    }, [currentPage]);

    // Load more data when approaching the last page
    useEffect(() => {
        if (currentPage === totalPages && hasMore && !isLoading) {
            onLoadMore();
        }
    }, [currentPage, totalPages, hasMore, isLoading, onLoadMore]);

    const handleThumbClick = useCallback((e: React.MouseEvent, stableId: string, isVideo: boolean) => {
        log.debug("render", "Thumbnail clicked", { stableId, isVideo });
        e.preventDefault();
        e.stopPropagation();
        // Pass filtered items so fullscreen respects the current filter
        onSelect(stableId, isVideo, filteredItems);
    }, [onSelect, filteredItems]);

    const handlePrevPage = useCallback(() => {
        if (currentPage > 1) {
            setCurrentPage(prev => prev - 1);
        }
    }, [currentPage]);

    const handleNextPage = useCallback(() => {
        if (currentPage < totalPages) {
            setCurrentPage(prev => prev + 1);
        }
    }, [currentPage, totalPages]);

    const mediaFilterOptions: ManaSelectOption[] = useMemo(() => {
        const options: ManaSelectOption[] = [
            { id: "images", value: "images", label: "Images" },
            { id: "gifs", value: "gifs", label: "Animated" } // Includes GIFs, animated WebP, APNG, etc.
        ];
        // Only show Videos option if videos are enabled
        if (enableVideos) {
            options.push({ id: "videos", value: "videos", label: "Videos" });
        }
        options.push(
            { id: "oldest", value: "oldest", label: "Oldest" },
            { id: "newest", value: "newest", label: "Newest" }
        );
        return options;
    }, [enableVideos]);

    const handleMediaFilterChange = useCallback((value: string) => {
        setMediaFilter(value as MediaFilterType);
    }, []);

    const handleUsernameFilterChange = useCallback((value: string) => {
        setUsernameFilter(value);
    }, []);

    return (
        <div className="vc-gallery-view-container">
            <div className="vc-gallery-filter-row">
                <div className="vc-gallery-filter-item">
                    <ManaSelect
                        value={mediaFilter}
                        onSelectionChange={handleMediaFilterChange}
                        options={mediaFilterOptions}
                        selectionMode="single"
                        closeOnSelect={true}
                        fullWidth={true}
                    />
                </div>
                <div className="vc-gallery-filter-item">
                    <ManaSelect
                        value={usernameFilter}
                        onSelectionChange={handleUsernameFilterChange}
                        options={usernameOptions}
                        selectionMode="single"
                        closeOnSelect={true}
                        fullWidth={true}
                    />
                </div>
            </div>

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
                                onClick={e => handleThumbClick(e, item.stableId, Boolean(item.isVideo))}
                                onMouseDown={e => e.preventDefault()}
                                className="vc-gallery-thumbnail-button"
                            >
                                <div className="vc-gallery-thumbnail-wrapper">
                                    {item.isVideo && !item.isEmbed && !failedVideos.has(item.stableId) ? (
                                        <>
                                            <video
                                                src={item.proxyUrl ?? item.url}
                                                className="vc-gallery-thumbnail-image"
                                                muted
                                                loop
                                                playsInline
                                                preload="metadata"
                                                onLoadedData={e => {
                                                    // Seek to first frame for thumbnail
                                                    const video = e.currentTarget;
                                                    if (video.duration && video.duration > 0) {
                                                        video.currentTime = 0.1;
                                                    }
                                                }}
                                                onError={() => {
                                                    setFailedVideos(prev => new Set(prev).add(item.stableId));
                                                    onMarkFailed(item.stableId);
                                                }}
                                            />
                                            <div className="vc-gallery-play-overlay">
                                                <svg width="48" height="48" viewBox="0 0 24 24" className="vc-gallery-play-icon">
                                                    <path fill="white" d="M8 5v14l11-7z" />
                                                </svg>
                                            </div>
                                        </>
                                    ) : (
                                        <img
                                            src={getThumbUrl(item, thumbSize)}
                                            alt={item.filename ?? "Image"}
                                            loading={item.isAnimated ? "eager" : "lazy"}
                                            decoding="async"
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
                        <div className="vc-gallery-status-muted">No media found</div>
                    ) : null}
                </div>
            </ScrollerThin>

            {filteredItems.length > 0 && (
                <div className="vc-gallery-pagination">
                    <button
                        className="vc-gallery-pagination-button"
                        disabled={currentPage === 1}
                        onClick={handlePrevPage}
                        aria-label="Previous page"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M15.41 7.41L14 6L8 12L14 18L15.41 16.59L10.83 12L15.41 7.41Z" />
                        </svg>
                    </button>
                    <div className="vc-gallery-page-info">
                        Page {currentPage} of {totalPages}
                    </div>
                    <button
                        className="vc-gallery-pagination-button"
                        disabled={currentPage === totalPages}
                        onClick={handleNextPage}
                        aria-label="Next page"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8.59 16.59L10 18L16 12L10 6L8.59 7.41L13.17 12L8.59 16.59Z" />
                        </svg>
                    </button>
                </div>
            )}
        </div>
    );
}
