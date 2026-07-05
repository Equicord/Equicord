/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { PresetFolder, ProfilePresetEx } from "./storage";

export const FOLDER_NAME_MAX_LENGTH = 64;

export const FOLDER_COLOR_SWATCHES = [
    "#5865f2",
    "#eb459e",
    "#ed4245",
    "#fee75c",
    "#57f287",
    "#00b0f4",
    "#9b59b6",
    "#e67e22",
    "#95a5a6",
    "#ffffff",
] as const;

const FOLDER_HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export function normalizeFolderHexColor(value: string): string | null {
    const trimmed = value.trim();
    if (!FOLDER_HEX_PATTERN.test(trimmed)) return null;
    return trimmed.toLowerCase();
}

export function isValidFolderHexColor(value: string | null | undefined): value is string {
    return value != null && FOLDER_HEX_PATTERN.test(value);
}

export function sanitizeFolderRecord(folder: PresetFolder): PresetFolder {
    const color = folder.color != null ? normalizeFolderHexColor(String(folder.color)) : null;
    const trimmedName = folder.name.trim().slice(0, FOLDER_NAME_MAX_LENGTH);
    return {
        id: folder.id,
        name: trimmedName || "Untitled",
        createdAt: folder.createdAt,
        color: color ?? null,
    };
}

export function createFolderId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function sortFolders(folderList: PresetFolder[]) {
    return [...folderList].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

export function getFolderById(folderList: PresetFolder[], id: string) {
    return folderList.find(folder => folder.id === id) ?? null;
}

export function countPresetsInFolder(presetList: ProfilePresetEx[], folderId: string | null) {
    if (folderId == null) {
        return presetList.filter(preset => preset.folderId == null).length;
    }
    return presetList.filter(preset => preset.folderId === folderId).length;
}

export function getPresetsInFolder(presetList: ProfilePresetEx[], folderId: string | null) {
    if (folderId == null) {
        return presetList.filter(preset => preset.folderId == null);
    }
    return presetList.filter(preset => preset.folderId === folderId);
}

export function getFolderMemberIndices(presetList: ProfilePresetEx[], folderId: string | null) {
    return presetList
        .map((preset, index) => ({ preset, index }))
        .filter(({ preset }) => (folderId == null ? preset.folderId == null : preset.folderId === folderId))
        .map(({ index }) => index);
}

export type FolderNameValidation =
    | { ok: true; name: string; }
    | { ok: false; reason: "empty" | "tooLong" | "duplicate"; };

export function validateFolderName(name: string, folderList: PresetFolder[], excludeId?: string): FolderNameValidation {
    const trimmed = name.trim();
    if (!trimmed) return { ok: false, reason: "empty" };
    if (trimmed.length > FOLDER_NAME_MAX_LENGTH) return { ok: false, reason: "tooLong" };
    const duplicate = folderList.some(
        folder => folder.id !== excludeId && folder.name.localeCompare(trimmed, undefined, { sensitivity: "base" }) === 0
    );
    if (duplicate) return { ok: false, reason: "duplicate" };
    return { ok: true, name: trimmed };
}

export function folderNameValidationMessage(reason: FolderNameValidation extends { ok: false; reason: infer R; } ? R : never) {
    switch (reason) {
        case "empty":
            return "Folder name cannot be empty.";
        case "tooLong":
            return `Folder name cannot exceed ${FOLDER_NAME_MAX_LENGTH} characters.`;
        case "duplicate":
            return "A folder with that name already exists.";
        default:
            return "Invalid folder name.";
    }
}
