/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Channel } from "@vencord/discord-types";
import { Constants, GuildChannelStore, GuildMemberStore, RestAPI, UserStore } from "@webpack/common";

export function shortDuration(ms: number) {
    const m = Math.floor(ms / 60_000);
    if (m < 1) return "<1m";
    if (m < 60) return `${m}m`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function clampNum(min: number, value: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

export interface AvatarTier {
    size: "SIZE_32" | "SIZE_40" | "SIZE_48" | "SIZE_56";
    px: number;
}

export const AVATAR_TIERS: Array<AvatarTier & { min: number; }> = [
    { min: 0, size: "SIZE_32", px: 80 },
    { min: 900, size: "SIZE_40", px: 128 },
    { min: 1300, size: "SIZE_48", px: 128 },
    { min: 1700, size: "SIZE_56", px: 256 }
];

export function pickAvatarTier(width: number): AvatarTier {
    let tier = AVATAR_TIERS[0];
    for (const t of AVATAR_TIERS) if (width >= t.min) tier = t;
    return tier;
}

export function getDisplayName(guildId: string | null, userId: string) {
    const user = UserStore.getUser(userId);
    if (!user) return "";
    return (guildId && GuildMemberStore.getNick(guildId, userId)) || user.globalName || user.username;
}

export const GROUP_KEYS = ["speaking", "live", "listening", "muted", "deafened"] as const;
export type Groups = Record<typeof GROUP_KEYS[number], string[]>;

export function sameGroups(a: Groups, b: Groups) {
    return GROUP_KEYS.every(k => a[k].length === b[k].length && a[k].every((id, i) => id === b[k][i]));
}

export function getVoiceChannels(guildId: string) {
    const channels = GuildChannelStore.getChannels(guildId) as { VOCAL?: { channel: Channel; comparator: number; }[]; };
    return (channels.VOCAL ?? []).map(({ channel }) => channel);
}

export function moveUser(guildId: string, userId: string, targetChannelId: string) {
    return RestAPI.patch({
        url: Constants.Endpoints.GUILD_MEMBER(guildId, userId),
        body: { channel_id: targetChannelId }
    });
}
