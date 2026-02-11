/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { isValidSnowflake, normalizeScore, type EmojiPayload } from "./crypto";

export type DuelData = {
    opponentId: string;
    opponentScore: number;
    viewerScore: number;
    channelId?: string;
    contextId?: string;
    opponentEmoji?: EmojiPayload;
};

export type OpenGamePayload = {
    type: "text"; value: string;
    channelId?: string;
    contextId?: string;
    messageId?: string;
    duel?: DuelData;
} | {
    type: "image"; url: string; alt?: string;
    channelId?: string;
    contextId?: string;
    messageId?: string;
    duel?: DuelData;
};

let openGameRef: ((emoji: OpenGamePayload) => void) | null = null;
const ALLOWED_EMOJI_PREFIXES = [
    "https://cdn.discordapp.com/emojis/",
    "https://discord.com/assets/"
];

function toSafeEmojiUrl(raw: unknown): string | null {
    if (typeof raw !== "string") return null;
    try {
        const url = new URL(raw, "https://discord.com");
        if (url.protocol !== "https:") return null;
        url.search = "";
        url.hash = "";
        const normalized = url.toString();
        if (!ALLOWED_EMOJI_PREFIXES.some(prefix => normalized.startsWith(prefix))) return null;
        return normalized;
    } catch {
        return null;
    }
}

function normalizeOpenEmoji(emoji: unknown): { type: "text"; value: string; } | { type: "image"; url: string; alt?: string; } {
    if (!emoji || typeof emoji !== "object") return { type: "text", value: "🏀" };
    if ("type" in emoji && emoji.type === "text" && "value" in emoji && typeof emoji.value === "string") {
        const value = emoji.value.trim();
        if (value.length > 0 && value.length <= 32) return { type: "text", value };
    }
    if ("type" in emoji && emoji.type === "image" && "url" in emoji && typeof emoji.url === "string") {
        const url = toSafeEmojiUrl(emoji.url);
        if (!url) return { type: "text", value: "🏀" };
        const alt = "alt" in emoji && typeof emoji.alt === "string" ? emoji.alt.trim().slice(0, 64) : undefined;
        return { type: "image", url, alt: alt && alt.length > 0 ? alt : undefined };
    }
    return { type: "text", value: "🏀" };
}

export function setOpenGameRef(fn: ((emoji: OpenGamePayload) => void) | null) {
    openGameRef = fn;
}

export function openChallenge(duel: DuelData) {
    if (!openGameRef) return false;
    if (!isValidSnowflake(duel.opponentId)) return false;
    if (!isValidSnowflake(duel.channelId)) return false;
    if (!isValidSnowflake(duel.contextId)) return false;
    const opponentScore = normalizeScore(duel.opponentScore);
    const viewerScore = normalizeScore(duel.viewerScore);
    if (opponentScore == null || viewerScore == null) return false;
    const baseEmoji = normalizeOpenEmoji(duel.opponentEmoji);
    openGameRef({
        ...baseEmoji,
        channelId: duel.channelId,
        contextId: duel.contextId,
        duel: {
            opponentId: duel.opponentId,
            opponentScore,
            viewerScore,
            channelId: duel.channelId,
            contextId: duel.contextId,
            opponentEmoji: baseEmoji
        }
    });
    return true;
}
