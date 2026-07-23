/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DataStore } from "@api/index";
import { Logger } from "@utils/Logger";
import { ProfilePreset } from "@vencord/discord-types";
import { UserStore } from "@webpack/common";

const logger = new Logger("ProfilePresets");
const PRESETS_KEY = "Profiles_v1";
const LEGACY_MAIN_KEY = "ProfilePresets_v2_Main";
const LEGACY_DATASET_KEY = "ProfileDataset";

export type ProfilePresetEx = ProfilePreset & {
    avatarRaw?: string | null;
};

export let presets: ProfilePresetEx[] = [];
export let currentPresetIndex = -1;

function resetPresets(nextPresets: ProfilePresetEx[] = []) {
    presets = nextPresets;
    currentPresetIndex = -1;
}

function getPresetsKey(userId: string) {
    return `${PRESETS_KEY}:${userId}`;
}

async function migrateLegacyPresets(userId: string, targetKey: string): Promise<boolean> {
    const existing = await DataStore.get(targetKey);
    if (existing && Array.isArray(existing) && existing.length > 0) return false;

    const v2Key = `${LEGACY_MAIN_KEY}:${userId}`;
    const stored = await DataStore.get(v2Key);
    if (stored && Array.isArray(stored) && stored.length > 0) {
        await DataStore.set(targetKey, stored);
        await DataStore.del(v2Key);
        return true;
    }
    const datasetKey = `${LEGACY_DATASET_KEY}:${userId}:main`;
    const datasetStored = await DataStore.get(datasetKey);
    if (datasetStored && Array.isArray(datasetStored) && datasetStored.length > 0) {
        await DataStore.set(targetKey, datasetStored);
        await DataStore.del(datasetKey);
        return true;
    }
    const bareStored = await DataStore.get(LEGACY_DATASET_KEY);
    if (bareStored && Array.isArray(bareStored) && bareStored.length > 0) {
        await DataStore.set(targetKey, bareStored);
        await DataStore.del(LEGACY_DATASET_KEY);
        return true;
    }
    return false;
}

export async function loadPresets() {
    try {
        const currentUser = UserStore.getCurrentUser();
        if (!currentUser) return;
        const key = getPresetsKey(currentUser.id);
        const stored = await DataStore.get(key);
        if (stored && Array.isArray(stored)) {
            resetPresets(stored);
            return;
        }
        const migrated = await migrateLegacyPresets(currentUser.id, key);
        if (migrated) {
            const migratedData = await DataStore.get(key);
            if (migratedData && Array.isArray(migratedData)) {
                resetPresets(migratedData);
                return;
            }
        }
        resetPresets();
    } catch (err) {
        logger.error("Failed to load presets", err);
        resetPresets();
    }
}

export async function savePresetsData() {
    try {
        const currentUser = UserStore.getCurrentUser();
        if (!currentUser) return;
        const key = getPresetsKey(currentUser.id);
        await DataStore.set(key, presets);
    } catch (err) {
        logger.error("Failed to save presets", err);
    }
}

export function setCurrentPresetIndex(index: number) {
    currentPresetIndex = index;
}

export function addPreset(preset: ProfilePresetEx) {
    presets.push(preset);
}

export function updatePreset(index: number, preset: ProfilePresetEx) {
    if (index >= 0 && index < presets.length) {
        presets[index] = preset;
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
    }
}

export function movePresetInArray(fromIndex: number, toIndex: number) {
    if (fromIndex < 0 || fromIndex >= presets.length || toIndex < 0 || toIndex >= presets.length) return;
    const [preset] = presets.splice(fromIndex, 1);
    presets.splice(toIndex, 0, preset);
}

export function replaceAllPresets(newPresets: ProfilePresetEx[]) {
    presets = newPresets;
    currentPresetIndex = -1;
}
