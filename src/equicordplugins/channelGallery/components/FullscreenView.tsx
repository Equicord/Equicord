/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { MediaModalItem, openMediaModal } from "@utils/modal";
import { findByPropsLazy } from "@webpack";

import type { GalleryItem } from "../utils/media";

// Helper to convert GalleryItem to MediaModalItem (optimized)
function itemToMediaItem(item: GalleryItem): MediaModalItem {
    const isAnimated = item.isAnimated ||
        item.filename?.toLowerCase().endsWith(".gif") ||
        item.url.toLowerCase().includes(".gif") ||
        item.url.toLowerCase().match(/\.(gif|mp4|webm|mov|m4v)(\?|$)/i) !== null;

    // Use original URL for animated media to avoid 415 errors with Discord proxy
    // Also use original URL for external services that don't support proxy/size params
    let mediaUrl = item.url;
    if (!isAnimated && item.proxyUrl) {
        try {
            const urlHost = new URL(item.url).hostname.toLowerCase();
            if (urlHost.includes("discord") || urlHost.includes("discordapp")) {
                mediaUrl = item.proxyUrl;
            }
        } catch {
            // Invalid URL, use original
        }
    }

    return {
        type: "IMAGE" as const,
        url: mediaUrl,
        original: item.url,
        alt: item.filename || "Image",
        width: item.width,
        height: item.height,
        animated: isAnimated
    };
}

// Preload images for faster navigation
function preloadAdjacentImages(items: GalleryItem[], index: number, windowSize: number = 3): void {
    const start = Math.max(0, index - windowSize);
    const end = Math.min(items.length, index + windowSize + 1);

    for (let i = start; i < end; i++) {
        const item = items[i];
        if (!item) continue;

        const mediaItem = itemToMediaItem(item);
        // Preload the image
        const img = new Image();
        img.src = mediaItem.url;
    }
}

let isOpeningFullscreenView = false;

export function openFullscreenView(
    items: GalleryItem[],
    selectedStableId: string,
    onClose: () => void
): void {
    if (isOpeningFullscreenView) return;
    if (!items || items.length === 0) return;

    isOpeningFullscreenView = true;

    const selectedIndex = items.findIndex(item => item && item.stableId === selectedStableId);
    const validIndex = selectedIndex >= 0 ? Math.min(selectedIndex, items.length - 1) : 0;

    preloadAdjacentImages(items, validIndex, 2);

    const mediaItems: MediaModalItem[] = items
        .filter((item): item is GalleryItem => Boolean(item))
        .map(itemToMediaItem);

    if (mediaItems.length === 0) {
        isOpeningFullscreenView = false;
        return;
    }

    let hasCalledOnClose = false;
    const handleClose = () => {
        if (hasCalledOnClose) return;
        hasCalledOnClose = true;
        isOpeningFullscreenView = false;
        onClose();
    };

    // Fallback: Poll hasModalOpen to detect when modal closes if onCloseCallback doesn't fire
    const ModalAPIModule = findByPropsLazy("hasModalOpen", "openModal");
    const MEDIA_MODAL_KEY = "Media Viewer Modal";
    let wasModalOpen = false;
    let checkInterval: ReturnType<typeof setInterval> | null = null;
    let cleanupTimeout: ReturnType<typeof setTimeout> | null = null;

    const cleanupInterval = () => {
        if (checkInterval) {
            clearInterval(checkInterval);
            checkInterval = null;
        }
        if (cleanupTimeout) {
            clearTimeout(cleanupTimeout);
            cleanupTimeout = null;
        }
    };

    const closeCallback = () => {
        cleanupInterval();
        handleClose();
    };

    checkInterval = setInterval(() => {
        const isModalOpen = ModalAPIModule?.hasModalOpen?.(MEDIA_MODAL_KEY) ?? false;

        if (isModalOpen) {
            wasModalOpen = true;
        } else if (wasModalOpen && isOpeningFullscreenView && !hasCalledOnClose) {
            cleanupInterval();
            handleClose();
        }
    }, 100);

    // Cleanup interval after 60 seconds to prevent memory leaks
    cleanupTimeout = setTimeout(cleanupInterval, 60000);

    openMediaModal({
        items: mediaItems,
        startingIndex: validIndex,
        location: "Channel Gallery",
        onCloseCallback: closeCallback
    });

    // Preload more images in the background (no cleanup needed - fire and forget)
    if (typeof requestIdleCallback !== "undefined") {
        requestIdleCallback(() => preloadAdjacentImages(items, validIndex, 5), { timeout: 1000 });
    } else {
        // Store timeout for potential cleanup, but it's fire-and-forget so we don't track it
        setTimeout(() => preloadAdjacentImages(items, validIndex, 5), 100);
    }
}
