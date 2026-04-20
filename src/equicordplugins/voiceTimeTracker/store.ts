/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DataStore } from "@api/index";
import { classNameFactory } from "@utils/css";
import { Logger } from "@utils/Logger";
import { ChannelStore, GuildStore, IconUtils, RelationshipStore, UserStore, VoiceStateStore } from "@webpack/common";

import { ChannelRow, FriendRow, GuildRow, UserChannelRow } from "./types";

export const cl = classNameFactory("vc-vtt-");
export const logger = new Logger("VoiceTimeTracker");

const CHANNEL_STORE_KEY = "VoiceTimeTracker_channels";
const USER_STORE_KEY = "VoiceTimeTracker_users";
const MESSAGES_STORE_KEY = "VoiceTimeTracker_messages";

export let channelTimeData: Record<string, number> = {};
export let userTimeData: Record<string, number> = {};
export let messageCountData: Record<string, number> = {};
export let joinTimestamp: number | null = null;
export let currentChannelId: string | null = null;
export const currentVoiceUsers = new Map<string, number>();

export function setJoinTimestamp(v: number | null) { joinTimestamp = v; }
export function setCurrentChannelId(v: string | null) { currentChannelId = v; }

export function formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
}

export function flushUserSessions() {
    if (!currentChannelId) return;
    const now = Date.now();

    for (const [userId, startTime] of currentVoiceUsers) {
        const elapsed = now - startTime;
        const key = `${userId}:${currentChannelId}`;
        userTimeData[key] = (userTimeData[key] ?? 0) + elapsed;
        currentVoiceUsers.set(userId, now);
    }
}

export function save() {
    DataStore.set(CHANNEL_STORE_KEY, channelTimeData).catch(e => logger.error("Failed to save channel time data", e));
    DataStore.set(USER_STORE_KEY, userTimeData).catch(e => logger.error("Failed to save user time data", e));
    DataStore.set(MESSAGES_STORE_KEY, messageCountData).catch(e => logger.error("Failed to save message count data", e));
}

export function flushCurrentSession() {
    if (!joinTimestamp || !currentChannelId) return;

    const elapsed = Date.now() - joinTimestamp;
    channelTimeData[currentChannelId] = (channelTimeData[currentChannelId] ?? 0) + elapsed;
    joinTimestamp = Date.now();

    flushUserSessions();
    save();
}

export function seedExistingUsers() {
    if (!currentChannelId) return;
    const states = VoiceStateStore.getVoiceStatesForChannel(currentChannelId);
    const myId = UserStore.getCurrentUser()?.id;
    const now = Date.now();

    for (const userId of Object.keys(states)) {
        if (userId === myId) continue;
        if (!currentVoiceUsers.has(userId)) {
            currentVoiceUsers.set(userId, now);
        }
    }
}

export function clearAllData() {
    channelTimeData = {};
    userTimeData = {};
    messageCountData = {};
    save();
}

export async function loadData() {
    const storedChannels = await DataStore.get<Record<string, number>>(CHANNEL_STORE_KEY);
    if (storedChannels) channelTimeData = storedChannels;

    const storedUsers = await DataStore.get<typeof userTimeData>(USER_STORE_KEY);
    if (storedUsers) userTimeData = storedUsers;

    const storedMessages = await DataStore.get<Record<string, number>>(MESSAGES_STORE_KEY);
    if (storedMessages) messageCountData = storedMessages;
}

export function getGuildIconUrl(guildId: string): string | null {
    const guild = GuildStore.getGuild(guildId);
    if (!guild?.icon) return null;
    return IconUtils.getGuildIconURL({ id: guild.id, icon: guild.icon, size: 32 }) ?? null;
}

export function getServerStats(): GuildRow[] {
    const guildTotals = new Map<string, number>();

    for (const [channelId, ms] of Object.entries(channelTimeData)) {
        const channel = ChannelStore.getChannel(channelId);
        const guildId = channel?.guild_id ?? "unknown";
        guildTotals.set(guildId, (guildTotals.get(guildId) ?? 0) + ms);
    }

    const rows: GuildRow[] = [];
    for (const [guildId, totalMs] of guildTotals) {
        const guild = GuildStore.getGuild(guildId);
        rows.push({ guildId, name: guild?.name ?? "Unknown Server", totalMs });
    }

    return rows.sort((a, b) => b.totalMs - a.totalMs);
}

export function getChannelStats(): ChannelRow[] {
    const rows: ChannelRow[] = [];

    for (const [channelId, ms] of Object.entries(channelTimeData)) {
        const channel = ChannelStore.getChannel(channelId);
        const guild = channel?.guild_id ? GuildStore.getGuild(channel.guild_id) : null;
        rows.push({
            channelId,
            guildId: channel?.guild_id ?? "unknown",
            guildName: guild?.name ?? "Unknown Server",
            channelName: channel?.name ?? "Unknown Channel",
            totalMs: ms,
        });
    }

    return rows.sort((a, b) => b.totalMs - a.totalMs);
}

export function getUserStats(): Map<string, UserChannelRow[]> {
    const byChannel = new Map<string, UserChannelRow[]>();

    for (const [key, ms] of Object.entries(userTimeData)) {
        const separatorIdx = key.indexOf(":");
        const userId = key.slice(0, separatorIdx);
        const channelId = key.slice(separatorIdx + 1);

        const existing = byChannel.get(channelId) ?? [];
        existing.push({ userId, channelId, totalMs: ms });
        byChannel.set(channelId, existing);
    }

    for (const users of byChannel.values()) {
        users.sort((a, b) => b.totalMs - a.totalMs);
    }

    return byChannel;
}

export function getTotalTime(): number {
    let total = 0;
    for (const ms of Object.values(channelTimeData)) total += ms;
    return total;
}

export function getTotalMessages(): number {
    let total = 0;
    for (const count of Object.values(messageCountData)) total += count;
    return total;
}

export function getFriendsStats(): FriendRow[] {
    const friendIds: string[] = RelationshipStore.getFriendIDs();
    const friendSet = new Set(friendIds);
    const totals = new Map<string, number>();

    for (const [key, ms] of Object.entries(userTimeData)) {
        const separatorIdx = key.indexOf(":");
        const userId = key.slice(0, separatorIdx);
        if (!friendSet.has(userId)) continue;
        totals.set(userId, (totals.get(userId) ?? 0) + ms);
    }

    const rows: FriendRow[] = [];
    for (const [userId, totalMs] of totals) {
        rows.push({ userId, totalMs });
    }

    return rows.sort((a, b) => b.totalMs - a.totalMs);
}
