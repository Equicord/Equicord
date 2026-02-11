/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const SHARE_LINK_LABEL = "Equipong";
const SHARE_LINK_PREFIX = "https://tenor.com/view/";
const SPECIAL_KEY = "equipong-secure-key-v1-5f4f8d7a9c2e";
const SNOWFLAKE_PATTERN = /^\d{17,20}$/;
const MAX_ENCRYPTED_LENGTH = 4096;
const MAX_SCORE = 250;
const ALLOWED_EMOJI_PREFIXES = [
    "https://cdn.discordapp.com/emojis/",
    "https://discord.com/assets/"
];
const ALLOWED_PAYLOAD_KEYS = new Set([
    "userId",
    "channelId",
    "contextId",
    "score",
    "highScore",
    "timestamp",
    "emoji",
    "duel"
]);
const ALLOWED_DUEL_KEYS = new Set([
    "opponentId",
    "opponentScore"
]);
const ALLOWED_TEXT_EMOJI_KEYS = new Set([
    "type",
    "value"
]);
const ALLOWED_IMAGE_EMOJI_KEYS = new Set([
    "type",
    "url",
    "alt"
]);

export interface SharePayload {
    userId: string;
    channelId: string;
    contextId: string;
    score: number;
    highScore?: number;
    timestamp: number;
    emoji?: EmojiPayload;
    duel?: DuelPayload;
}

export type EmojiPayload =
    | { type: "text"; value: string }
    | { type: "image"; url: string; alt?: string };

export interface DuelPayload {
    opponentId: string;
    opponentScore: number;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function isValidSnowflake(value: unknown): value is string {
    return typeof value === "string" && SNOWFLAKE_PATTERN.test(value);
}

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

export function normalizeScore(value: unknown): number | null {
    const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? "0"), 10);
    if (!Number.isFinite(parsed)) return null;
    const score = Math.trunc(parsed);
    if (score < 0 || score > MAX_SCORE) return null;
    return score;
}

function hasOnlyKeys(value: unknown, allowedKeys: Set<string>) {
    if (!value || typeof value !== "object") return false;
    return Object.keys(value).every(key => allowedKeys.has(key));
}

function normalizeEmoji(emoji: unknown): EmojiPayload | undefined | null {
    if (emoji == null) return undefined;
    if (!emoji || typeof emoji !== "object") return null;
    if ("type" in emoji && emoji.type === "text") {
        if (!hasOnlyKeys(emoji, ALLOWED_TEXT_EMOJI_KEYS)) return null;
        if (!("value" in emoji) || typeof emoji.value !== "string") return null;
        const value = emoji.value.trim();
        if (value.length < 1 || value.length > 32) return null;
        return { type: "text", value };
    }
    if ("type" in emoji && emoji.type === "image") {
        if (!hasOnlyKeys(emoji, ALLOWED_IMAGE_EMOJI_KEYS)) return null;
        if (!("url" in emoji)) return null;
        const url = toSafeEmojiUrl(emoji.url);
        if (!url) return null;
        const rawAlt = "alt" in emoji ? emoji["alt"] : undefined;
        if (rawAlt != null && typeof rawAlt !== "string") return null;
        const alt = typeof rawAlt === "string" ? rawAlt.trim().slice(0, 64) : undefined;
        return { type: "image", url, alt: alt && alt.length > 0 ? alt : undefined };
    }
    return null;
}

function normalizePayload(payload: unknown): SharePayload | null {
    if (!payload || typeof payload !== "object") return null;
    if (!hasOnlyKeys(payload, ALLOWED_PAYLOAD_KEYS)) return null;
    if (!("userId" in payload) || !isValidSnowflake(payload.userId)) return null;
    if (!("channelId" in payload) || !isValidSnowflake(payload.channelId)) return null;
    if (!("contextId" in payload) || !isValidSnowflake(payload.contextId)) return null;
    if (!("score" in payload)) return null;
    const score = normalizeScore(payload.score);
    if (score == null) return null;
    let highScore: number | undefined;
    if ("highScore" in payload && payload.highScore != null) {
        const normalizedHigh = normalizeScore(payload.highScore);
        if (normalizedHigh == null) return null;
        highScore = normalizedHigh;
    }
    if (!("timestamp" in payload) || typeof payload.timestamp !== "number" || !Number.isFinite(payload.timestamp)) return null;
    const timestamp = Math.trunc(payload.timestamp);
    const now = Date.now();
    if (timestamp < 0 || timestamp > now + 60_000) return null;
    const emoji = normalizeEmoji("emoji" in payload ? payload.emoji : undefined);
    if ("emoji" in payload && payload.emoji != null && !emoji) return null;
    let duel: DuelPayload | undefined;
    if ("duel" in payload && payload.duel != null) {
        const rawDuel = payload.duel;
        if (!rawDuel || typeof rawDuel !== "object") return null;
        if (!hasOnlyKeys(rawDuel, ALLOWED_DUEL_KEYS)) return null;
        if (!("opponentId" in rawDuel) || !isValidSnowflake(rawDuel.opponentId)) return null;
        if (!("opponentScore" in rawDuel)) return null;
        const opponentScore = normalizeScore(rawDuel.opponentScore);
        if (opponentScore == null) return null;
        duel = {
            opponentId: rawDuel.opponentId,
            opponentScore
        };
    }
    return {
        userId: payload.userId,
        channelId: payload.channelId,
        contextId: payload.contextId,
        score,
        highScore,
        timestamp,
        emoji: emoji ?? undefined,
        duel
    };
}

function bytesToBase64(bytes: Uint8Array) {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

function base64ToBytes(value: string) {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    return new Uint8Array(bytes).buffer;
}

async function deriveKey(channelId: string, contextId: string, userId: string) {
    if (!isValidSnowflake(channelId) || !isValidSnowflake(contextId) || !isValidSnowflake(userId)) return null;
    const material = encoder.encode(`${SPECIAL_KEY}|${channelId}|${contextId}|${userId}`);
    const hash = await crypto.subtle.digest("SHA-256", material);
    return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptPayload(payload: SharePayload) {
    if (!crypto?.subtle) return null;
    const normalized = normalizePayload(payload);
    if (!normalized) return null;
    const key = await deriveKey(normalized.channelId, normalized.contextId, normalized.userId);
    if (!key) return null;
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = encoder.encode(JSON.stringify(normalized));
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: toArrayBuffer(iv) }, key, toArrayBuffer(data));
    const cipherBytes = new Uint8Array(encrypted);
    return `${bytesToBase64(iv)}.${bytesToBase64(cipherBytes)}`;
}

export async function decryptPayload(
    encrypted: string,
    channelId: string,
    contextId: string,
    userId: string
): Promise<SharePayload | null> {
    if (!crypto?.subtle) return null;
    if (typeof encrypted !== "string" || encrypted.length < 8 || encrypted.length > MAX_ENCRYPTED_LENGTH) return null;
    if (!isValidSnowflake(channelId) || !isValidSnowflake(contextId) || !isValidSnowflake(userId)) return null;
    const parts = encrypted.split(".");
    if (parts.length !== 2) return null;
    const [ivB64, dataB64] = parts;
    if (!ivB64 || !dataB64) return null;
    if (!/^[A-Za-z0-9+/=]+$/.test(ivB64) || !/^[A-Za-z0-9+/=]+$/.test(dataB64)) return null;
    let iv: Uint8Array;
    let data: Uint8Array;
    try {
        iv = Uint8Array.from(base64ToBytes(ivB64));
        data = Uint8Array.from(base64ToBytes(dataB64));
    } catch {
        return null;
    }
    if (iv.length !== 12 || data.length < 16) return null;
    const key = await deriveKey(channelId, contextId, userId);
    if (!key) return null;
    try {
        const decrypted = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: toArrayBuffer(iv) },
            key,
            toArrayBuffer(data)
        );
        const json = decoder.decode(decrypted);
        const payload = JSON.parse(json) as unknown;
        const normalized = normalizePayload(payload);
        if (!normalized) return null;
        if (normalized.userId !== userId) return null;
        if (normalized.channelId !== channelId) return null;
        if (normalized.contextId !== contextId) return null;
        return normalized;
    } catch {
        return null;
    }
}

export function buildShareMessage(encrypted: string) {
    const encoded = encodeURIComponent(encrypted);
    return `[${SHARE_LINK_LABEL}](${SHARE_LINK_PREFIX}${encoded})`;
}

export function parseShareMessage(content: string) {
    const match = content.match(/^\[Equipong\]\(https:\/\/tenor\.com\/view\/([A-Za-z0-9._~%-]+)\)$/);
    if (!match?.[1]) return null;
    const token = match[1];
    if (token.length > MAX_ENCRYPTED_LENGTH * 3) return null;
    try {
        const decoded = decodeURIComponent(token);
        if (!/^[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/.test(decoded)) return null;
        if (decoded.length > MAX_ENCRYPTED_LENGTH) return null;
        return decoded;
    } catch {
        return null;
    }
}
