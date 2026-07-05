/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { ProfilePresetEx } from "./storage";

export const PRESET_NAME_MAX_LENGTH = 64;

const FORBIDDEN_FOLDER_IDS = new Set(["__proto__", "constructor", "prototype"]);

const SAFE_DATA_IMAGE = /^data:image\/(?:png|jpe?g|gif|webp|bmp);/i;

const DISCORD_ASSET_HASH = /^[a-zA-Z0-9_]+$/;

export function isSafeFolderId(id: string) {
    return id.length > 0 && !FORBIDDEN_FOLDER_IDS.has(id);
}

export function isSafeImageUrl(value: unknown): value is string {
    if (typeof value !== "string") return false;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > 8_000_000) return false;
    if (/[\0\r\n]/.test(trimmed)) return false;

    if (trimmed.startsWith("data:image/")) {
        const comma = trimmed.indexOf(",");
        if (comma < 0) return false;
        const header = trimmed.slice(0, comma);
        if (/[;\s]url\s*\(/i.test(header)) return false;
        return SAFE_DATA_IMAGE.test(header);
    }

    if (trimmed.startsWith("https://")) {
        try {
            return new URL(trimmed).protocol === "https:";
        } catch {
            return false;
        }
    }

    return false;
}

export function sanitizeImageUrl(value: unknown): string | null {
    if (value == null) return null;
    return isSafeImageUrl(value) ? value.trim() : null;
}

export function normalizePresetName(name: unknown): string {
    if (typeof name !== "string") return "Untitled";
    const trimmed = name.trim();
    if (!trimmed) return "Untitled";
    return trimmed.slice(0, PRESET_NAME_MAX_LENGTH);
}

export function sanitizePresetForStorage(raw: ProfilePresetEx): ProfilePresetEx {
    const folderId = typeof raw.folderId === "string" && raw.folderId.length > 0 && isSafeFolderId(raw.folderId)
        ? raw.folderId
        : null;

    return {
        name: normalizePresetName(raw.name),
        timestamp: typeof raw.timestamp === "number" && Number.isFinite(raw.timestamp) ? raw.timestamp : Date.now(),
        avatarDataUrl: sanitizeImageUrl(raw.avatarDataUrl),
        bannerDataUrl: sanitizeImageUrl(raw.bannerDataUrl),
        bio: typeof raw.bio === "string" ? raw.bio : raw.bio ?? null,
        accentColor: typeof raw.accentColor === "number" && Number.isFinite(raw.accentColor) ? raw.accentColor : raw.accentColor ?? null,
        themeColors: Array.isArray(raw.themeColors) ? raw.themeColors : raw.themeColors ?? null,
        globalName: typeof raw.globalName === "string" ? raw.globalName : raw.globalName ?? null,
        pronouns: typeof raw.pronouns === "string" ? raw.pronouns : raw.pronouns ?? null,
        avatarDecoration: raw.avatarDecoration ?? null,
        profileEffect: raw.profileEffect ?? null,
        nameplate: raw.nameplate ?? null,
        primaryGuildId: typeof raw.primaryGuildId === "string" ? raw.primaryGuildId : raw.primaryGuildId ?? null,
        customStatus: raw.customStatus ?? null,
        displayNameStyles: raw.displayNameStyles ?? null,
        avatarRaw: typeof raw.avatarRaw === "string" && DISCORD_ASSET_HASH.test(raw.avatarRaw)
            ? raw.avatarRaw
            : null,
        folderId,
    };
}
