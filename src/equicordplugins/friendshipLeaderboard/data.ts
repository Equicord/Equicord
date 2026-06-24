/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { openPrivateChannel } from "@utils/discord";
import { Logger } from "@utils/Logger";
import { sleep } from "@utils/misc";
import { ChannelStore, Constants, IconUtils, moment, RelationshipStore, RestAPI, UserStore } from "@webpack/common";

import { FRIENDSHIP_RANK_BADGES, FriendshipRankBadge, LeaderboardEntry, SortMode, SortModes } from "./types";

const logger = new Logger("FriendshipLeaderboard");

const DAYS_PER_YEAR = 365.25;
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const FALLBACK_PAGE_LIMIT = 8;
const FALLBACK_PAGE_SIZE = 100;

export const messageCountCache: Record<string, number> = {};

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
    return `${messages} message${messages === 1 ? "" : "s"} sent.`;
}

export function getFriendEntries(): LeaderboardEntry[] {
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
                messageCount: messageCountCache[friendId]
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
    return nameDiff !== 0 ? nameDiff : a.id.localeCompare(b.id);
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

async function fallbackCountRecentSentMessages(channelId: string, currentUserId: string): Promise<number> {
    let before: string | undefined;
    let count = 0;

    for (let page = 0; page < FALLBACK_PAGE_LIMIT; page++) {
        const result = await withRateLimit(() => RestAPI.get({
            url: Constants.Endpoints.MESSAGES(channelId),
            query: { limit: FALLBACK_PAGE_SIZE, ...(before ? { before } : {}) }
        }));

        const messages: Array<{ id: string; author?: { id?: string; }; }> = result?.body ?? [];
        if (!messages.length) break;

        for (const msg of messages) {
            if (msg.author?.id === currentUserId) count++;
        }

        const last = messages[messages.length - 1];
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

export async function getSentMessageCount(friendId: string): Promise<number> {
    if (messageCountCache[friendId] != null) return messageCountCache[friendId];

    const currentUserId = UserStore.getCurrentUser()?.id;
    if (!currentUserId) return 0;

    const channelId = await resolveDmChannelId(friendId);
    if (!channelId) return 0;

    try {
        const result = await withRateLimit(() => RestAPI.get({
            url: Constants.Endpoints.SEARCH_CHANNEL(channelId),
            query: { author_id: currentUserId, offset: 0 }
        }));

        let count = Number(result?.body?.total_results) || 0;

        if (count <= 0) count = await fallbackCountRecentSentMessages(channelId, currentUserId);

        messageCountCache[friendId] = count;
        await sleep(300);
        return count;
    } catch (e) {
        logger.warn("Search endpoint failed for", friendId, "— falling back to manual count.", e);
        try {
            const count = await fallbackCountRecentSentMessages(channelId, currentUserId);
            messageCountCache[friendId] = count;
            return count;
        } catch (e2) {
            logger.error("Fallback message count also failed for", friendId, e2);
            return 0;
        }
    }
}
