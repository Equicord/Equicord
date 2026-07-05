/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DataStore } from "@api/index";
import { Logger } from "@utils/Logger";
import { ProfilePreset } from "@vencord/discord-types";
import { UserStore } from "@webpack/common";

import { createFolderId, getFolderMemberIndices, normalizeFolderHexColor, sanitizeFolderRecord, validateFolderName } from "./folders";
import { isSafeFolderId, sanitizePresetForStorage } from "./sanitize";

const logger = new Logger("ProfileSets");
const LEGACY_PRESETS_KEY = "ProfileDataset";
const MAIN_PRESETS_KEY_V2 = "ProfilePresets_v2_Main";
const SERVER_PRESETS_KEY_V2 = "ProfilePresets_v2_Server";
const MAIN_PRESETS_KEY = "ProfilePresets_v3_Main";
const SERVER_PRESETS_KEY = "ProfilePresets_v3_Server";

export type PresetSection = "main" | "server";

export type PresetFolder = {
    id: string;
    name: string;
    createdAt: number;
    color?: string | null;
};

export type ProfilePresetEx = ProfilePreset & {
    avatarRaw?: string | null;
    folderId?: string | null;
};

export type PresetStoreV3 = {
    version: 3;
    folders: PresetFolder[];
    presets: ProfilePresetEx[];
};

export type FolderDeleteMode = "moveToRoot" | "deleteAll";

export let folders: PresetFolder[] = [];
export let presets: ProfilePresetEx[] = [];
export let currentPresetIndex = -1;
let storeRevision = 0;
let activeScopeKey: string | null = null;
let activeSection: PresetSection | null = null;
let loadGeneration = 0;

function isStaleLoad(generation: number) {
    return generation !== loadGeneration;
}

function bumpStoreRevision() {
    storeRevision++;
}

export function getStoreRevision() {
    return storeRevision;
}

function resetStore(nextFolders: PresetFolder[] = [], nextPresets: ProfilePresetEx[] = []) {
    folders = nextFolders.map(sanitizeFolderRecord).filter(folder => isSafeFolderId(folder.id));
    presets = nextPresets.map(sanitizePresetForStorage);
    currentPresetIndex = -1;
    bumpStoreRevision();
}

function folderMemberIndices(folderId: string | null) {
    return getFolderMemberIndices(presets, folderId);
}

function getPresetsKey(section: PresetSection, userId: string) {
    const baseKey = section === "main" ? MAIN_PRESETS_KEY : SERVER_PRESETS_KEY;
    return `${baseKey}:${userId}`;
}

function getPresetsKeyV2(section: PresetSection, userId: string) {
    const baseKey = section === "main" ? MAIN_PRESETS_KEY_V2 : SERVER_PRESETS_KEY_V2;
    return `${baseKey}:${userId}`;
}

function getLegacyKey(userId: string) {
    return `${LEGACY_PRESETS_KEY}:${userId}:main`;
}

function normalizePresetList(raw: ProfilePresetEx[]): ProfilePresetEx[] {
    return raw.map(sanitizePresetForStorage);
}

function buildStoreV3(nextPresets: ProfilePresetEx[], nextFolders: PresetFolder[] = []): PresetStoreV3 {
    return {
        version: 3,
        folders: nextFolders,
        presets: normalizePresetList(nextPresets),
    };
}

function isPresetStoreV3(value: unknown): value is PresetStoreV3 {
    return Boolean(
        value
        && typeof value === "object"
        && (value as PresetStoreV3).version === 3
        && Array.isArray((value as PresetStoreV3).folders)
        && Array.isArray((value as PresetStoreV3).presets)
    );
}

function isPresetArray(value: unknown): value is ProfilePresetEx[] {
    return Array.isArray(value);
}

async function persistStore(section?: PresetSection) {
    if (!activeScopeKey && !section) return;
    const currentUser = UserStore.getCurrentUser();
    if (!currentUser) return;
    const userId = currentUser.id;
    const key = section ? getPresetsKey(section, userId) : activeScopeKey!;
    const payload = buildStoreV3(presets, folders);
    await DataStore.set(key, payload);
}

async function migrateLegacyToV3(
    section: PresetSection,
    userId: string,
    legacyPresets: ProfilePresetEx[],
    generation: number
) {
    const store = buildStoreV3(legacyPresets);
    const v3Key = getPresetsKey(section, userId);
    try {
        await DataStore.set(v3Key, store);
    } catch (err) {
        logger.error("Failed to migrate presets to v3", err);
        return;
    }
    if (isStaleLoad(generation)) return;
    resetStore(store.folders, store.presets);
    activeScopeKey = v3Key;
    activeSection = section;
    try {
        const v2Key = getPresetsKeyV2(section, userId);
        await DataStore.del(v2Key);
        if (section === "main") {
            await DataStore.del(getLegacyKey(userId));
            await DataStore.del(LEGACY_PRESETS_KEY);
        }
    } catch (err) {
        logger.error("Failed to clean up legacy preset keys after migration", err);
    }
}

export async function loadPresets(section: PresetSection) {
    const generation = ++loadGeneration;

    try {
        const currentUser = UserStore.getCurrentUser();
        if (!currentUser) {
            if (isStaleLoad(generation)) return;
            activeScopeKey = null;
            activeSection = null;
            resetStore();
            return;
        }

        const userId = currentUser.id;
        const v3Key = getPresetsKey(section, userId);
        const storedV3 = await DataStore.get(v3Key);
        if (isStaleLoad(generation)) return;

        if (isPresetStoreV3(storedV3)) {
            activeScopeKey = v3Key;
            activeSection = section;
            resetStore(storedV3.folders, storedV3.presets);
            return;
        }

        const v2Key = getPresetsKeyV2(section, userId);
        const storedV2 = await DataStore.get(v2Key);
        if (isStaleLoad(generation)) return;

        if (isPresetArray(storedV2)) {
            await migrateLegacyToV3(section, userId, storedV2, generation);
            return;
        }

        if (section === "main") {
            const legacyKey = getLegacyKey(userId);
            const legacyStored = await DataStore.get(legacyKey);
            if (isStaleLoad(generation)) return;

            const legacyBaseStored = await DataStore.get(LEGACY_PRESETS_KEY);
            if (isStaleLoad(generation)) return;

            const legacyToUse = Array.isArray(legacyStored)
                ? legacyStored
                : (Array.isArray(legacyBaseStored) ? legacyBaseStored : null);
            if (legacyToUse) {
                await migrateLegacyToV3(section, userId, legacyToUse, generation);
                return;
            }
        }

        activeScopeKey = v3Key;
        activeSection = section;
        resetStore();
    } catch (err) {
        if (isStaleLoad(generation)) return;
        logger.error("Failed to load presets", err);
        resetStore();
    }
}

export async function savePresetsData(section?: PresetSection) {
    try {
        await persistStore(section);
    } catch (err) {
        logger.error("Failed to save presets", err);
    }
}

export async function saveStoreData(section?: PresetSection) {
    return savePresetsData(section);
}

export function setCurrentPresetIndex(index: number) {
    currentPresetIndex = index;
}

export function addPreset(preset: ProfilePresetEx, folderId?: string | null) {
    presets.push(sanitizePresetForStorage({
        ...preset,
        folderId: folderId ?? preset.folderId ?? null,
    }));
    bumpStoreRevision();
}

export function updatePreset(index: number, preset: ProfilePresetEx) {
    if (index >= 0 && index < presets.length) {
        presets[index] = sanitizePresetForStorage(preset);
        bumpStoreRevision();
    }
}

export function removePreset(index: number) {
    if (index >= 0 && index < presets.length) {
        presets.splice(index, 1);
        if (currentPresetIndex === index) {
            currentPresetIndex = -1;
        } else if (currentPresetIndex > index) {
            currentPresetIndex--;
        }
        bumpStoreRevision();
    }
}

export function movePresetInArray(fromIndex: number, toIndex: number) {
    if (fromIndex < 0 || fromIndex >= presets.length || toIndex < 0 || toIndex >= presets.length) return;
    const [preset] = presets.splice(fromIndex, 1);
    presets.splice(toIndex, 0, preset);
    bumpStoreRevision();
}

export function movePresetWithinFolder(globalIndex: number, direction: -1 | 1, folderId: string | null) {
    const members = folderMemberIndices(folderId);
    const position = members.indexOf(globalIndex);
    if (position < 0) return;
    const targetPosition = position + direction;
    if (targetPosition < 0 || targetPosition >= members.length) return;
    movePresetInArray(members[position], members[targetPosition]);
}

export function movePresetToFolderFront(globalIndex: number, folderId: string | null) {
    const members = folderMemberIndices(folderId);
    const position = members.indexOf(globalIndex);
    if (position <= 0) return;
    movePresetInArray(members[position], members[0]);
}

export function replaceAllPresets(newPresets: ProfilePresetEx[]) {
    presets = normalizePresetList(newPresets);
    bumpStoreRevision();
}

export function replaceStore(next: { folders?: PresetFolder[]; presets: ProfilePresetEx[]; }) {
    folders = (next.folders ?? []).map(sanitizeFolderRecord).filter(folder => isSafeFolderId(folder.id));
    presets = normalizePresetList(next.presets);
    bumpStoreRevision();
}

export function getStoreSnapshot(): PresetStoreV3 {
    return buildStoreV3(presets, folders);
}

export function addFolderValidated(name: string, color?: string | null): PresetFolder {
    const normalizedColor = color != null && color !== "" ? normalizeFolderHexColor(color) : null;
    const folder: PresetFolder = {
        id: createFolderId(),
        name,
        createdAt: Date.now(),
        color: normalizedColor ?? null,
    };
    folders.push(folder);
    bumpStoreRevision();
    return folder;
}

export function addFolder(name: string): PresetFolder | null {
    const validation = validateFolderName(name, folders);
    if (!validation.ok) return null;
    return addFolderValidated(validation.name);
}

export function renameFolder(id: string, name: string): boolean {
    const folder = folders.find(entry => entry.id === id);
    if (!folder) return false;
    const validation = validateFolderName(name, folders, id);
    if (!validation.ok) return false;
    folder.name = validation.name;
    bumpStoreRevision();
    return true;
}

export function removeFolder(id: string, mode: FolderDeleteMode): ProfilePresetEx[] {
    const removedPresets: ProfilePresetEx[] = [];
    if (mode === "moveToRoot") {
        presets.forEach(preset => {
            if (preset.folderId === id) preset.folderId = null;
        });
    } else {
        for (let i = presets.length - 1; i >= 0; i--) {
            if (presets[i].folderId === id) {
                removedPresets.push(presets[i]);
                removePreset(i);
            }
        }
    }
    folders = folders.filter(folder => folder.id !== id);
    bumpStoreRevision();
    return removedPresets;
}

export function moveFolderInArray(fromIndex: number, toIndex: number) {
    if (fromIndex < 0 || fromIndex >= folders.length || toIndex < 0 || toIndex >= folders.length) return;
    const [folder] = folders.splice(fromIndex, 1);
    folders.splice(toIndex, 0, folder);
    bumpStoreRevision();
}

export function setFolderColor(folderIndex: number, color: string | null) {
    if (folderIndex < 0 || folderIndex >= folders.length) return;
    folders[folderIndex] = {
        ...folders[folderIndex],
        color: color != null ? normalizeFolderHexColor(color) : null,
    };
    bumpStoreRevision();
}

export function setPresetFolder(presetIndex: number, folderId: string | null) {
    if (presetIndex < 0 || presetIndex >= presets.length) return;
    if (folderId != null && !isSafeFolderId(folderId)) return;
    presets[presetIndex] = {
        ...presets[presetIndex],
        folderId,
    };
    bumpStoreRevision();
}

export function getActiveSection() {
    return activeSection;
}
