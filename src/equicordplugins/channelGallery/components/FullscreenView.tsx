/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { MediaModalItem, openMediaModal } from "@utils/modal";
import { findByPropsLazy } from "@webpack";
import { ChannelStore, NavigationRouter } from "@webpack/common";

import { log } from "../utils/logging";
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

// Fullscreen state - exported for external reset
let fullscreenState = {
    isOpening: false,
    isClosing: false,
    hasCalledClose: false,
    checkInterval: null as ReturnType<typeof setInterval> | null,
    cleanupTimeout: null as ReturnType<typeof setTimeout> | null,
    lastStateChange: null as number | null,
    sessionId: 0 // Session token to invalidate stale callbacks
};

// Reset fullscreen state - call before opening to ensure clean state
export function resetFullscreenState(): void {
    if (fullscreenState.checkInterval) {
        clearInterval(fullscreenState.checkInterval);
    }
    if (fullscreenState.cleanupTimeout) {
        clearTimeout(fullscreenState.cleanupTimeout);
    }
    // Increment session ID to invalidate any pending callbacks
    fullscreenState = {
        isOpening: false,
        isClosing: false,
        hasCalledClose: false,
        checkInterval: null,
        cleanupTimeout: null,
        lastStateChange: null,
        sessionId: fullscreenState.sessionId + 1
    };
}

// Check if fullscreen is currently active/transitioning
export function isFullscreenActive(): boolean {
    return fullscreenState.isOpening || fullscreenState.isClosing;
}

export function openFullscreenView(
    items: GalleryItem[],
    selectedStableId: string,
    onClose: () => void
): void {
    // Guard against rapid opening - but allow if we're stuck in a bad state
    if (fullscreenState.isOpening || fullscreenState.isClosing) {
        // If stuck for more than 2 seconds, force reset and continue
        // Check if we're actually stuck (state hasn't changed in 2+ seconds)
        const now = Date.now();
        if (!fullscreenState.lastStateChange || (now - fullscreenState.lastStateChange) < 2000) {
            return;
        }
        // Force reset if stuck
        resetFullscreenState();
    }

    if (!items || items.length === 0) return;

    // Reset state before opening
    resetFullscreenState();
    fullscreenState.isOpening = true;
    fullscreenState.lastStateChange = Date.now();

    // Capture session ID for this fullscreen instance
    const currentSessionId = fullscreenState.sessionId;

    log.info("lifecycle", "Opening fullscreen view", {
        itemsCount: items.length,
        selectedStableId,
        sessionId: fullscreenState.sessionId
    });

    // Filter out videos - only images and GIFs in fullscreen
    const nonVideoItems = items.filter(item => item && !item.isVideo);
    if (nonVideoItems.length === 0) {
        fullscreenState.isOpening = false;
        return;
    }

    // Find the selected item in the filtered list
    let selectedIndex = nonVideoItems.findIndex(item => item && item.stableId === selectedStableId);
    // If the selected item was a video (shouldn't happen) or not found, default to first
    if (selectedIndex < 0) selectedIndex = 0;

    preloadAdjacentImages(nonVideoItems, selectedIndex, 2);

    const mediaItems: MediaModalItem[] = nonVideoItems
        .filter((item): item is GalleryItem => Boolean(item))
        .map(itemToMediaItem);

    if (mediaItems.length === 0) {
        fullscreenState.isOpening = false;
        return;
    }

    const handleClose = () => {
        log.debug("lifecycle", "Fullscreen close callback", {
            sessionId: fullscreenState.sessionId,
            currentSessionId
        });
        // Check if this callback is for the current session (prevent stale callbacks)
        if (fullscreenState.sessionId !== currentSessionId) return;
        // Prevent double-calling
        if (fullscreenState.hasCalledClose) return;
        fullscreenState.hasCalledClose = true;

        // Clean up interval/timeout first
        if (fullscreenState.checkInterval) {
            clearInterval(fullscreenState.checkInterval);
            fullscreenState.checkInterval = null;
        }
        if (fullscreenState.cleanupTimeout) {
            clearTimeout(fullscreenState.cleanupTimeout);
            fullscreenState.cleanupTimeout = null;
        }

        // Reset state immediately (this increments sessionId and clears all flags)
        resetFullscreenState();

        // Call onClose after state is fully reset
        onClose();
    };

    // Fallback: Poll hasModalOpen to detect when modal closes if onCloseCallback doesn't fire
    const ModalAPIModule = findByPropsLazy("hasModalOpen", "openModal");
    const MEDIA_MODAL_KEY = "Media Viewer Modal";
    let wasModalOpen = false;
    let openCheckCount = 0;

    fullscreenState.checkInterval = setInterval(() => {
        // Check if this interval is for the current session (prevent stale intervals)
        if (fullscreenState.sessionId !== currentSessionId) {
            clearInterval(fullscreenState.checkInterval!);
            return;
        }

        const isModalOpen = ModalAPIModule?.hasModalOpen?.(MEDIA_MODAL_KEY) ?? false;

        if (isModalOpen) {
            wasModalOpen = true;
            openCheckCount = 0;
        } else if (wasModalOpen && !fullscreenState.hasCalledClose) {
            // Modal was open but is now closed - trigger close
            handleClose();
        } else if (!wasModalOpen && fullscreenState.isOpening) {
            // Modal never opened - increment counter
            openCheckCount++;
            // If modal hasn't opened after 2 seconds, something went wrong - reset
            if (openCheckCount > 20) {
                resetFullscreenState();
            }
        }
    }, 100);

    // Cleanup interval after 60 seconds to prevent memory leaks
    fullscreenState.cleanupTimeout = setTimeout(() => {
        if (fullscreenState.checkInterval) {
            clearInterval(fullscreenState.checkInterval);
            fullscreenState.checkInterval = null;
        }
        // If we're still in opening state after 60s, reset
        if (fullscreenState.isOpening && !fullscreenState.hasCalledClose) {
            resetFullscreenState();
        }
    }, 60000);

    // Track current item for Enter key navigation
    let currentItemIndex = selectedIndex;
    const currentItems = nonVideoItems;

    // Add keyboard listener for Enter key to jump to message
    const handleKeyDown = (e: KeyboardEvent) => {
        // Only handle Enter if we're in fullscreen and not typing in an input
        if (e.key === "Enter" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
            if (currentItems && currentItems.length > 0 && currentItemIndex >= 0 && currentItemIndex < currentItems.length) {
                const currentItem = currentItems[currentItemIndex];
                if (currentItem && currentItem.messageId && currentItem.channelId) {
                    e.preventDefault();
                    e.stopPropagation();

                    // Get guild ID from channel
                    const channel = ChannelStore.getChannel(currentItem.channelId);
                    const guildId = channel?.guild_id ?? "@me";

                    // Jump to message
                    const url = `/channels/${guildId}/${currentItem.channelId}/${currentItem.messageId}`;
                    NavigationRouter.transitionTo(url);

                    // Close the modal
                    handleClose();
                }
            }
        }
    };

    // Track arrow key navigation to update currentItemIndex
    // Note: This is a best-effort approach since we can't directly track Discord's modal navigation
    // We'll update based on arrow key presses
    const handleArrowKeys = (e: KeyboardEvent) => {
        if (e.key === "ArrowLeft" && currentItemIndex > 0) {
            currentItemIndex--;
        } else if (e.key === "ArrowRight" && currentItemIndex < currentItems.length - 1) {
            currentItemIndex++;
        }
    };

    // Add keyboard listeners when modal opens
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keydown", handleArrowKeys, true);

    // Update handleClose to also remove keyboard listeners
    const originalHandleClose = handleClose;
    const enhancedHandleClose = () => {
        window.removeEventListener("keydown", handleKeyDown, true);
        window.removeEventListener("keydown", handleArrowKeys, true);
        originalHandleClose();
    };

    openMediaModal({
        items: mediaItems,
        startingIndex: selectedIndex,
        location: "Channel Gallery",
        onCloseCallback: enhancedHandleClose
    });

    log.info("lifecycle", "Media modal opened", {
        itemsCount: mediaItems.length,
        startingIndex: selectedIndex
    });

    // Preload more images in the background (no cleanup needed - fire and forget)
    if (typeof requestIdleCallback !== "undefined") {
        requestIdleCallback(() => preloadAdjacentImages(nonVideoItems, selectedIndex, 5), { timeout: 1000 });
    } else {
        setTimeout(() => preloadAdjacentImages(nonVideoItems, selectedIndex, 5), 100);
    }
}
