/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { openPrivateChannel } from "@utils/discord";
import { Logger } from "@utils/Logger";
import { sleep } from "@utils/misc";
import { ChannelStore, Constants, IconUtils, moment, RelationshipStore, RestAPI, UserStore } from "@webpack/common";

import { FRIENDSHIP_RANK_BADGES, FriendshipRankBadge, LeaderboardEntry, MessageCountMode, MessageCountModes, SortMode, SortModes } from "./types";

const logger = new Logger("FriendshipLeaderboard");

const DAYS_PER_YEAR = 365.25;
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const FALLBACK_PAGE_LIMIT = 8;
const FALLBACK_PAGE_SIZE = 100;
const MESSAGE_COUNT_REQUEST_DELAY_MS = 1200;

export const messageCountCache: Record<string, number> = {};
let messageCountRequestQueue = Promise.resolve();
let activeMessageCountBatch: Promise<void> | null = null;

export function daysSince(dateString?: string | null): number {
    if (!dateString) return 0;
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return 0;
    return Math.max(0, Math.floor((Date.now() - date.getTime()) / MS_PER_DAY));
}

export function formatExactDate(dateString?: string | null): string | null {
    if (!dateString) return null;
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return null;
    return moment(date).format("LL");
}

export function formatFriendshipTooltip(days: number, friendshipSince?: string | null): string {
    const n = Math.max(1, days);
    const dayText = `${n} day${n === 1 ? "" : "s"}`;
    const exactDate = formatExactDate(friendshipSince);
    return exactDate ? `${dayText} • Since ${exactDate}` : dayText;
}

export function formatYears(years: number): string {
    if (years < 1) {
        const days = Math.max(1, Math.floor(years * DAYS_PER_YEAR));
        return `${days} day${days === 1 ? "" : "s"}`;
    }
    return `${years.toFixed(1)} years`;
}

export function formatLeaderboardValue(entry: LeaderboardEntry, sortMode: SortMode): string {
    if (sortMode === SortModes.FRIENDSHIP) return formatYears(entry.friendshipYears);
    if (entry.messageCount == null) return "...";
    return String(entry.messageCount);
}

export function getLeaderboardTooltip(entry: LeaderboardEntry, sortMode: SortMode): string {
    if (sortMode === SortModes.FRIENDSHIP) return formatFriendshipTooltip(entry.friendshipDays, entry.friendshipSince);
    const messages = entry.messageCount ?? 0;
    return `${messages} message${messages === 1 ? "" : "s"} counted.`;
}

export function getCacheKey(friendId: string, mode: MessageCountMode): string {
    return `${friendId}_${mode}`;
}

export function getFriendEntries(messageCountMode: MessageCountMode): LeaderboardEntry[] {
    return RelationshipStore.getFriendIDs()
        .map<LeaderboardEntry | null>(friendId => {
            const user = UserStore.getUser(friendId);
            if (!user) return null;

            const friendshipSince = RelationshipStore.getSince(friendId) ?? null;
            const friendshipDays = daysSince(friendshipSince);

            return {
                id: friendId,
                name: RelationshipStore.getNickname(friendId) || user.globalName || user.username,
                avatarUrl: IconUtils.getUserAvatarURL(user, true, 128) || "",
                friendshipDays,
                friendshipSince,
                friendshipYears: friendshipDays / DAYS_PER_YEAR,
                messageCount: messageCountCache[getCacheKey(friendId, messageCountMode)]
            } satisfies LeaderboardEntry;
        })
        .filter((entry): entry is LeaderboardEntry => entry !== null);
}

export function getLeaderboardRank(index: number, total: number, sortDescending: boolean): number {
    return sortDescending ? index + 1 : total - index;
}

export function compareEntries(a: LeaderboardEntry, b: LeaderboardEntry, sortDescending: boolean, sortMode: SortMode): number {
    let diff = 0;

    if (sortMode === SortModes.FRIENDSHIP) {
        diff = sortDescending ? b.friendshipDays - a.friendshipDays : a.friendshipDays - b.friendshipDays;
    } else {
        diff = sortDescending
            ? (b.messageCount ?? 0) - (a.messageCount ?? 0)
            : (a.messageCount ?? 0) - (b.messageCount ?? 0);
    }

    if (diff !== 0) return diff;
    const nameDiff = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    return nameDiff || a.id.localeCompare(b.id);
}

export function getFriendshipRankBadge(friendshipDays: number): FriendshipRankBadge | null {
    let result: FriendshipRankBadge | null = null;
    for (const badge of FRIENDSHIP_RANK_BADGES) {
        if (friendshipDays >= badge.requirement) result = badge;
    }
    return result;
}

async function resolveDmChannelId(friendId: string): Promise<string | null> {
    const existing = ChannelStore.getDMFromUserId(friendId);
    if (existing) return existing;

    openPrivateChannel(friendId, false);

    for (let attempt = 0; attempt < 20; attempt++) {
        const channelId = ChannelStore.getDMFromUserId(friendId);
        if (channelId) return channelId;
        await sleep(120);
    }

    return null;
}

async function withMessageCountRateLimit<T>(fn: () => Promise<T>): Promise<T> {
    const previous = messageCountRequestQueue;
    let release!: () => void;
    messageCountRequestQueue = new Promise<void>(resolve => {
        release = resolve;
    });

    await previous.catch(() => { });

    try {
        return await fn();
    } finally {
        await sleep(MESSAGE_COUNT_REQUEST_DELAY_MS);
        release();
    }
}

function shouldCountMessage(msg: { author?: { id?: string; }; }, currentUserId: string, friendId: string, mode: MessageCountMode): boolean {
    if (mode === MessageCountModes.SENT) return msg.author?.id === currentUserId;
    if (mode === MessageCountModes.RECEIVED) return msg.author?.id === friendId;
    return true;
}

async function fallbackCountRecentMessages(channelId: string, currentUserId: string, friendId: string, mode: MessageCountMode): Promise<number> {
    let before: string | undefined;
    let count = 0;

    for (let page = 0; page < FALLBACK_PAGE_LIMIT; page++) {
        const result = await withMessageCountRateLimit(() => withRateLimit(() => RestAPI.get({
            url: Constants.Endpoints.MESSAGES(channelId),
            query: { limit: FALLBACK_PAGE_SIZE, ...(before ? { before } : {}) }
        })));

        const messages: Array<{ id: string; author?: { id?: string; }; }> = result?.body ?? [];
        if (!messages.length) break;

        for (const msg of messages) {
            if (shouldCountMessage(msg, currentUserId, friendId, mode)) count++;
        }

        const last = messages.at(-1);
        if (!last || messages.length < FALLBACK_PAGE_SIZE) break;
        before = last.id;

        await sleep(300);
    }

    return count;
}

async function withRateLimit<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (e: any) {
            const isRateLimit = e?.status === 429;
            const isLastAttempt = attempt === maxRetries;

            if (!isRateLimit || isLastAttempt) throw e;

            const retryAfterMs = ((e?.body?.retry_after ?? e?.retryAfter) || 2) * 1000;
            logger.warn(`Rate limited — waiting ${retryAfterMs}ms before retry ${attempt + 1}/${maxRetries}.`);
            await sleep(retryAfterMs);
        }
    }

    throw new Error("unreachable");
}

export async function loadMessageCountsForEntries(
    entries: readonly LeaderboardEntry[],
    onProgress?: (entry: LeaderboardEntry, remaining: number) => void,
    mode: MessageCountMode = MessageCountModes.SENT
): Promise<void> {
    if (activeMessageCountBatch) {
        await activeMessageCountBatch;
        return;
    }

    activeMessageCountBatch = (async () => {
        const remainingEntries = entries.filter(entry => messageCountCache[getCacheKey(entry.id, mode)] == null);

        for (let index = 0; index < remainingEntries.length; index++) {
            const entry = remainingEntries[index];
            if (messageCountCache[getCacheKey(entry.id, mode)] != null) continue;
            await getMessageCount(entry.id, mode);
            onProgress?.(entry, remainingEntries.length - index - 1);
        }
    })();

    try {
        await activeMessageCountBatch;
    } finally {
        activeMessageCountBatch = null;
    }
}

export async function getMessageCount(friendId: string, mode: MessageCountMode): Promise<number> {
    const cacheKey = getCacheKey(friendId, mode);
    if (messageCountCache[cacheKey] != null) return messageCountCache[cacheKey];

    const currentUserId = UserStore.getCurrentUser()?.id;
    if (!currentUserId) return 0;

    const channelId = await resolveDmChannelId(friendId);
    if (!channelId) return 0;

    const deriveFromExistingCounts = (): number | null => {
        if (mode === MessageCountModes.ALL) {
            const sent = messageCountCache[getCacheKey(friendId, MessageCountModes.SENT)];
            const received = messageCountCache[getCacheKey(friendId, MessageCountModes.RECEIVED)];
            if (sent != null && received != null) return sent + received;
            return null;
        }

        if (mode === MessageCountModes.SENT) {
            const all = messageCountCache[getCacheKey(friendId, MessageCountModes.ALL)];
            const received = messageCountCache[getCacheKey(friendId, MessageCountModes.RECEIVED)];
            if (all != null && received != null) return Math.max(0, all - received);
        }

        if (mode === MessageCountModes.RECEIVED) {
            const all = messageCountCache[getCacheKey(friendId, MessageCountModes.ALL)];
            const sent = messageCountCache[getCacheKey(friendId, MessageCountModes.SENT)];
            if (all != null && sent != null) return Math.max(0, all - sent);
        }

        return null;
    };

    const derivedCount = deriveFromExistingCounts();
    if (derivedCount != null) {
        messageCountCache[cacheKey] = derivedCount;
        return derivedCount;
    }

    try {
        const query: Record<string, string | number> = { offset: 0 };
        if (mode === MessageCountModes.SENT) query.author_id = currentUserId;
        if (mode === MessageCountModes.RECEIVED) query.author_id = friendId;

        const result = await withMessageCountRateLimit(() => withRateLimit(() => RestAPI.get({
            url: Constants.Endpoints.SEARCH_CHANNEL(channelId),
            query
        })));

        let count = Number(result?.body?.total_results) || 0;

        if (count <= 0) count = await fallbackCountRecentMessages(channelId, currentUserId, friendId, mode);

        messageCountCache[cacheKey] = count;
        await sleep(300);
        return count;
    } catch (e) {
        logger.warn("Search endpoint failed for", friendId, "— falling back to manual count.", e);
        try {
            const count = await fallbackCountRecentMessages(channelId, currentUserId, friendId, mode);
            messageCountCache[cacheKey] = count;
            return count;
        } catch (error_) {
            logger.error("Fallback message count also failed for", friendId, error_);
            return 0;
        }
    }
}

export async function getSentMessageCount(friendId: string): Promise<number> {
    return getMessageCount(friendId, MessageCountModes.SENT);
}
