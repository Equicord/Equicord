/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { isNonNullish } from "@utils/guards";
import { chooseFile, saveFile } from "@utils/web";
import { ProfilePreset } from "@vencord/discord-types";
import { findStoreLazy } from "@webpack";
import { showToast, Toasts } from "@webpack/common";

import { createFolderId, FOLDER_NAME_MAX_LENGTH, folderNameValidationMessage, normalizeFolderHexColor, sanitizeFolderRecord, validateFolderName } from "./folders";
import { getCurrentProfile } from "./profile";
import { isSafeFolderId, normalizePresetName, sanitizePresetForStorage } from "./sanitize";
import {
    addFolderValidated,
    addPreset,
    FolderDeleteMode,
    folders,
    getStoreSnapshot,
    moveFolderInArray,
    movePresetInArray,
    movePresetToFolderFront,
    movePresetWithinFolder,
    PresetFolder,
    presets,
    PresetSection,
    type ProfilePresetEx,
    removeFolder,
    removePreset,
    renameFolder,
    replaceStore,
    savePresetsData,
    setFolderColor,
    setPresetFolder,
    updatePreset,
} from "./storage";
import { deleteBindingForPreset, renameBindingKey } from "./themeBindings";

const UserProfileSettingsStore = findStoreLazy("UserProfileSettingsStore");
const MAX_IMPORT_PRESETS = 500;
const MAX_IMPORT_FOLDERS = 100;

function isImageInput(value: unknown): value is string | { imageUri: string; } {
    if (typeof value === "string") return value.length > 0;
    return typeof value === "object" && isNonNullish(value) && "imageUri" in value && typeof (value as { imageUri: unknown }).imageUri === "string";
}

function getFreshPendingImage(
    section: PresetSection,
    guildId: string | undefined,
    keys: string[]
): string | null {
    const pending = (section === "server" && guildId
        ? UserProfileSettingsStore.getPendingChanges?.(guildId)
        : UserProfileSettingsStore.getPendingChanges?.()) ?? {};
    const pendingObj = pending as Record<string, unknown>;
    const selected = keys.map(k => pendingObj[k]).find(isImageInput);
    if (!selected) return null;
    return typeof selected === "string" ? selected : selected.imageUri;
}

function getFreshPendingAvatar(section: PresetSection, guildId?: string): string | null {
    return getFreshPendingImage(section, guildId, ["pendingAvatar"]);
}

function getFreshPendingBanner(section: PresetSection, guildId?: string): string | null {
    return getFreshPendingImage(section, guildId, ["pendingBanner", "banner"]);
}

function isValidPreset(value: unknown): value is ProfilePresetEx {
    if (!value || typeof value !== "object") return false;
    const record = value as Record<string, unknown>;
    return typeof record.name === "string"
        && record.name.trim().length > 0
        && typeof record.timestamp === "number"
        && Number.isFinite(record.timestamp);
}

function isValidFolder(value: unknown): value is PresetFolder {
    if (!value || typeof value !== "object") return false;
    const record = value as Record<string, unknown>;
    return typeof record.id === "string"
        && isSafeFolderId(record.id)
        && typeof record.name === "string"
        && typeof record.createdAt === "number"
        && Number.isFinite(record.createdAt);
}

function sanitizeImportedPreset(raw: ProfilePresetEx): ProfilePresetEx {
    return sanitizePresetForStorage(raw);
}

function sanitizeImportedFolder(raw: PresetFolder): PresetFolder {
    return sanitizeFolderRecord({
        id: raw.id,
        name: raw.name.trim().slice(0, FOLDER_NAME_MAX_LENGTH) || "Untitled",
        createdAt: raw.createdAt,
        color: raw.color,
    });
}

type ParsedImport = {
    folders: PresetFolder[];
    presets: ProfilePresetEx[];
};

function sanitizePresetFolderIds(store: ParsedImport): ParsedImport {
    const folderIds = new Set(store.folders.map(folder => folder.id));
    return {
        folders: store.folders,
        presets: store.presets.map(preset => ({
            ...preset,
            folderId: preset.folderId && folderIds.has(preset.folderId) ? preset.folderId : null,
        })),
    };
}

function parseImportPayload(raw: unknown): ParsedImport | null {
    if (Array.isArray(raw)) {
        if (raw.length > MAX_IMPORT_PRESETS) return null;
        if (!raw.every(isValidPreset)) return null;
        return sanitizePresetFolderIds({
            folders: [],
            presets: raw.map(preset => sanitizeImportedPreset(preset)),
        });
    }

    if (!raw || typeof raw !== "object") return null;
    const record = raw as Record<string, unknown>;
    if (record.version === 3) {
        const nextFolders = record.folders;
        const nextPresets = record.presets;
        if (!Array.isArray(nextFolders) || !Array.isArray(nextPresets)) return null;
        if (nextFolders.length > MAX_IMPORT_FOLDERS || nextPresets.length > MAX_IMPORT_PRESETS) return null;
        if (!nextFolders.every(isValidFolder) || !nextPresets.every(isValidPreset)) return null;
        return sanitizePresetFolderIds({
            folders: nextFolders.map(sanitizeImportedFolder).filter(folder => isSafeFolderId(folder.id)),
            presets: nextPresets.map(preset => sanitizeImportedPreset({ ...preset, folderId: preset.folderId ?? null })),
        });
    }

    return null;
}

function remapImportedFolders(
    imported: ParsedImport,
    existingFolderIds: Set<string>,
    existingFolders: PresetFolder[] = []
): ParsedImport {
    const idMap = new Map<string, string>();
    const usedNames = new Set(
        existingFolders.map(folder => folder.name.toLocaleLowerCase())
    );

    const nextFolders = imported.folders.map(folder => {
        let nextId = folder.id;
        if (existingFolderIds.has(nextId)) {
            nextId = createFolderId();
        }
        existingFolderIds.add(nextId);
        idMap.set(folder.id, nextId);

        let nextName = folder.name.trim();
        if (!nextName) nextName = "Imported folder";
        let suffix = 1;
        const baseName = nextName;
        while (usedNames.has(nextName.toLocaleLowerCase())) {
            nextName = `${baseName} (${suffix})`;
            suffix++;
        }
        usedNames.add(nextName.toLocaleLowerCase());

        return {
            ...folder,
            id: nextId,
            name: nextName,
        };
    });

    const nextPresets = imported.presets.map(preset => sanitizeImportedPreset({
        ...preset,
        folderId: preset.folderId ? (idMap.get(preset.folderId) ?? null) : null,
    }));

    return sanitizePresetFolderIds({ folders: nextFolders, presets: nextPresets });
}

function mergeStores(existing: ParsedImport, imported: ParsedImport): ParsedImport | null {
    const existingIds = new Set(existing.folders.map(folder => folder.id));
    const remapped = remapImportedFolders(imported, existingIds, existing.folders);
    const merged = sanitizePresetFolderIds({
        folders: [...existing.folders, ...remapped.folders],
        presets: [...existing.presets, ...remapped.presets],
    });
    if (merged.folders.length > MAX_IMPORT_FOLDERS || merged.presets.length > MAX_IMPORT_PRESETS) {
        return null;
    }
    return merged;
}

export async function savePreset(
    name: string,
    section: PresetSection,
    guildId?: string,
    folderId?: string | null
) {
    if (!name.trim()) return;
    const trimmedName = normalizePresetName(name);
    const profile = await getCurrentProfile(guildId, { isGuildProfile: section === "server" });
    const freshPendingAvatar = getFreshPendingAvatar(section, guildId);
    const freshPendingBanner = getFreshPendingBanner(section, guildId);
    const effectiveAvatar = freshPendingAvatar ?? profile.avatarDataUrl ?? null;
    const effectiveBanner = freshPendingBanner ?? profile.bannerDataUrl ?? null;

    const newPreset: ProfilePresetEx = sanitizePresetForStorage({
        name: trimmedName,
        timestamp: Date.now(),
        ...profile,
        avatarDataUrl: effectiveAvatar,
        bannerDataUrl: effectiveBanner,
        folderId: folderId ?? null,
    });
    addPreset(newPreset, folderId ?? null);
    await savePresetsData(section);
}

export async function updatePresetField<K extends keyof Omit<ProfilePreset, "name" | "timestamp">>(
    index: number,
    field: K,
    value: Omit<ProfilePreset, "name" | "timestamp">[K],
    section: PresetSection,
    guildId?: string
) {
    if (index < 0 || index >= presets.length) return;

    const updatedPreset = {
        ...presets[index],
        [field]: value,
        timestamp: Date.now()
    };
    updatePreset(index, updatedPreset);
    await savePresetsData(section);
}

export async function deletePreset(index: number, section: PresetSection, guildId?: string) {
    if (index < 0 || index >= presets.length) return;

    deleteBindingForPreset(section, guildId, presets[index].name);
    removePreset(index);
    await savePresetsData(section);
}

export async function movePreset(fromIndex: number, toIndex: number, section: PresetSection, guildId?: string) {
    movePresetInArray(fromIndex, toIndex);
    await savePresetsData(section);
}

export async function movePresetInView(
    index: number,
    direction: -1 | 1,
    folderId: string | null,
    section: PresetSection,
    guildId?: string
) {
    if (index < 0 || index >= presets.length) return;
    movePresetWithinFolder(index, direction, folderId);
    await savePresetsData(section);
}

export async function movePresetToViewFront(
    index: number,
    folderId: string | null,
    section: PresetSection,
    guildId?: string
) {
    if (index < 0 || index >= presets.length) return;
    movePresetToFolderFront(index, folderId);
    await savePresetsData(section);
}

export async function renamePreset(index: number, newName: string, section: PresetSection, guildId?: string) {
    const trimmedName = normalizePresetName(newName);
    if (index < 0 || index >= presets.length || !newName.trim()) return;

    const oldName = presets[index].name;
    const updatedPreset = sanitizePresetForStorage({ ...presets[index], name: trimmedName });
    updatePreset(index, updatedPreset);
    renameBindingKey(section, guildId, oldName, trimmedName);
    await savePresetsData(section);
}

export async function movePresetToFolder(
    index: number,
    folderId: string | null,
    section: PresetSection,
    guildId?: string
) {
    if (index < 0 || index >= presets.length) return;
    if (folderId != null && !folders.some(folder => folder.id === folderId)) return;
    setPresetFolder(index, folderId);
    await savePresetsData(section);
}

export async function moveFolder(fromIndex: number, toIndex: number, section: PresetSection) {
    moveFolderInArray(fromIndex, toIndex);
    await savePresetsData(section);
}

export async function changeFolderColor(folderIndex: number, color: string | null, section: PresetSection) {
    setFolderColor(folderIndex, color);
    await savePresetsData(section);
}

export async function createFolder(name: string, section: PresetSection, color?: string | null) {
    const validation = validateFolderName(name, folders);
    if (!validation.ok) {
        showToast(folderNameValidationMessage(validation.reason), Toasts.Type.FAILURE);
        return null;
    }
    const normalizedColor = color != null ? normalizeFolderHexColor(color) : null;
    if (color != null && color !== "" && !normalizedColor) {
        showToast("Folder color must be a valid hex value like #5865f2.", Toasts.Type.FAILURE);
        return null;
    }
    const folder = addFolderValidated(validation.name, normalizedColor);
    await savePresetsData(section);
    return folder;
}

export async function renameFolderAction(id: string, name: string, section: PresetSection) {
    const validation = validateFolderName(name, folders, id);
    if (!validation.ok) {
        showToast(folderNameValidationMessage(validation.reason), Toasts.Type.FAILURE);
        return false;
    }
    const ok = renameFolder(id, validation.name);
    if (!ok) {
        showToast("Could not rename folder.", Toasts.Type.FAILURE);
        return false;
    }
    await savePresetsData(section);
    return true;
}

export async function deleteFolderAction(
    id: string,
    mode: FolderDeleteMode,
    section: PresetSection,
    guildId?: string
) {
    const removedPresets = removeFolder(id, mode);
    if (mode === "deleteAll") {
        for (const preset of removedPresets) {
            deleteBindingForPreset(section, guildId, preset.name);
        }
    }
    await savePresetsData(section);
    return removedPresets.length;
}

export function exportPresets(section: PresetSection) {
    const snapshot = getStoreSnapshot();
    const dataStr = JSON.stringify(snapshot, null, 2);
    saveFile(new File([dataStr], `profile-presets-${section}-${Date.now()}.json`, { type: "application/json" }));
}

export type ImportDecision = "override" | "merge" | "cancel";

export async function importPresets(
    forceUpdate: () => void,
    onImportPrompt: (existingCount: number) => Promise<ImportDecision>,
    section: PresetSection,
    guildId?: string
) {
    const file = await chooseFile("application/json");
    if (!file) return;

    try {
        const text = await file.text();
        if (text.length > 50_000_000) {
            showToast("Import file is too large.", Toasts.Type.FAILURE);
            return;
        }

        const parsed = JSON.parse(text) as unknown;
        const imported = parseImportPayload(parsed);
        if (!imported) {
            showToast("Invalid preset file: expected a preset array or version 3 store.", Toasts.Type.FAILURE);
            return;
        }

        const existing = getStoreSnapshot();
        const hasExisting = existing.presets.length > 0 || existing.folders.length > 0;

        if (hasExisting) {
            const decision = await onImportPrompt(existing.presets.length);
            if (decision === "cancel") return;
            if (decision === "override") {
                replaceStore(imported);
            } else {
                const merged = mergeStores(existing, imported);
                if (!merged) {
                    showToast("Import would exceed folder or profile limits.", Toasts.Type.FAILURE);
                    return;
                }
                replaceStore(merged);
            }
        } else {
            replaceStore(imported);
        }

        await savePresetsData(section);
        forceUpdate();
    } catch {
        showToast("Failed to import presets. The file might be invalid.", Toasts.Type.FAILURE);
    }
}
