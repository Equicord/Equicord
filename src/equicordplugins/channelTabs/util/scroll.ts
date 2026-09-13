/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Channel } from "@vencord/discord-types";
import { findByCodeLazy } from "@webpack";
import { MessageActions, useLayoutEffect } from "@webpack/common";

import { settings } from "./constants";
import { ChannelTabsProps } from "./types";

const getWindowId: (target: Window) => string = findByCodeLazy(/return \i\.__DISCORD_WINDOW_ID\}/);

interface ScrollAnchor {
    id: string;
    offsetFromTop: number;
    offsetTop: number;
    offsetHeight: number;
    clamped: boolean;
}

interface ScrollManager {
    props: { channel: Channel; windowId: string; };
    getScrollerState(): { scrollTop: number; };
    findAnchor(): ScrollAnchor | null;
    getAnchorData(messageId: string, scrollTop: number): ScrollAnchor | null;
    setAutomaticAnchor(anchor: ScrollAnchor | null): void;
    isReady(): boolean;
    isJumping(): boolean;
    isScrolledToBottom(): boolean;
    scrollTo(position: number, animate?: boolean, callback?: () => void): void;
    setScrollToBottom(): void;
    handleScroll(): void;
}

// cache for the tab state (so like scroll pos etc)
interface TabStateCache {
    channelId: string;
    scrollPosition: number;
    messageId?: string;
    offsetFromTop: number;
    atBottom: boolean;
    timestamp: number;
}
export const tabStateCache = new Map<number, TabStateCache>();
const MAX_CACHE_SIZE = 50;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// discord's main chat scroller
let scrollManager: ScrollManager | undefined;
let restoreGeneration = 0;
let restoreFrame: number | undefined;
let pendingRestore: { state: TabStateCache; generation: number; } | undefined;

function cancelRestore() {
    restoreGeneration++;
    pendingRestore = undefined;
    if (restoreFrame !== undefined) {
        cancelAnimationFrame(restoreFrame);
        restoreFrame = undefined;
    }
}

export function clearTabState() {
    cancelRestore();
    tabStateCache.clear();
}

function evictStaleCache() {
    const now = Date.now();

    for (const [tabId, cache] of tabStateCache.entries()) {
        if (now - cache.timestamp > CACHE_TTL_MS) {
            tabStateCache.delete(tabId);
        }
    }

    if (tabStateCache.size > MAX_CACHE_SIZE) {
        const entries = Array.from(tabStateCache.entries())
            .sort((a, b) => a[1].timestamp - b[1].timestamp);

        const entriesToRemove = entries.slice(0, tabStateCache.size - MAX_CACHE_SIZE);
        for (const [tabId] of entriesToRemove) {
            tabStateCache.delete(tabId);
        }
    }
}

export function cacheCurrentTabState(tab: ChannelTabsProps | undefined, tabs: ChannelTabsProps[]) {
    const wasRestoring = pendingRestore !== undefined || restoreFrame !== undefined;
    cancelRestore();
    if (wasRestoring || !tab || !scrollManager || scrollManager.props.channel.id !== tab.channelId || !scrollManager.isReady() || scrollManager.isJumping()) return;
    if (!settings.store.renderAllTabs && !tabs.some(other => other.id !== tab.id && other.channelId === tab.channelId)) {
        tabStateCache.delete(tab.id);
        return;
    }

    const anchor = scrollManager.findAnchor();
    tabStateCache.set(tab.id, {
        channelId: tab.channelId,
        scrollPosition: scrollManager.getScrollerState().scrollTop,
        messageId: anchor?.id,
        offsetFromTop: anchor?.offsetFromTop ?? 0,
        atBottom: scrollManager.isScrolledToBottom(),
        timestamp: Date.now()
    });
    evictStaleCache();
}

function restorePendingState() {
    if (!pendingRestore || restoreFrame !== undefined) return;

    // restore scroll pos after delay to make sure content loaded
    restoreFrame = requestAnimationFrame(() => {
        restoreFrame = undefined;
        const pending = pendingRestore;
        const manager = scrollManager;
        if (!pending || !manager || manager.props.channel.id !== pending.state.channelId || !manager.isReady()) return;
        pendingRestore = undefined;
        const { state, generation } = pending;
        const restoreAnchor = () => {
            if (generation !== restoreGeneration || manager !== scrollManager || manager.props.channel.id !== state.channelId) return;
            const anchor = state.messageId ? manager.getAnchorData(state.messageId, manager.getScrollerState().scrollTop) : null;
            if (anchor || !state.messageId) {
                manager.setAutomaticAnchor(anchor ? { ...anchor, offsetFromTop: state.offsetFromTop } : null);
                manager.scrollTo(anchor ? anchor.offsetTop - state.offsetFromTop : state.scrollPosition, false, manager.handleScroll);
            }
        };

        if (state.atBottom) {
            manager.setAutomaticAnchor(null);
            manager.setScrollToBottom();
        } else if (state.messageId && !manager.getAnchorData(state.messageId, manager.getScrollerState().scrollTop)) {
            let scheduled = false;
            MessageActions.jumpToMessage({
                channelId: state.channelId,
                messageId: state.messageId,
                flash: false,
                jumpType: "INSTANT",
                context: "ChannelTabs",
                onJumpComplete: () => {
                    if (scheduled || generation !== restoreGeneration) return;
                    scheduled = true;
                    restoreFrame = requestAnimationFrame(() => {
                        restoreFrame = undefined;
                        restoreAnchor();
                    });
                }
            });
        } else {
            restoreAnchor();
        }
    });
}

export function restoreTabState(tabId: number, channelId: string) {
    cancelRestore();
    evictStaleCache();
    const state = tabStateCache.get(tabId);
    if (!state || state.channelId !== channelId) return;
    pendingRestore = { state, generation: restoreGeneration };
    restorePendingState();
}

export function useScrollManager(manager: ScrollManager, isMainChat: boolean) {
    useLayoutEffect(() => {
        if (!isMainChat || manager.props.windowId !== getWindowId(window)) return;
        scrollManager = manager;
        restorePendingState();
    });

    useLayoutEffect(() => () => {
        if (scrollManager === manager) scrollManager = undefined;
    }, [manager]);

    return manager;
}
