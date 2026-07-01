/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DataStore } from "@api/index";
import { Logger } from "@utils/Logger";
import { ProfilePreset } from "@vencord/discord-types";
import { UserStore } from "@webpack/common";

const logger = new Logger("ProfileSets");
const LEGACY_PRESETS_KEY = "ProfileDataset";
const MAIN_PRESETS_KEY = "ProfilePresets_v2_Main";
const SERVER_PRESETS_KEY = "ProfilePresets_v2_Server";

export type PresetSection = "main" | "server";

export type ProfilePresetEx = ProfilePreset & {
    avatarRaw?: string | null;
};

export let presets: ProfilePresetEx[] = [];
export let currentPresetIndex = -1;
let activeScopeKey: string | null = null;
let loadGeneration = 0;

function isStaleLoad(generation: number) {
    return generation !== loadGeneration;
}

function resetPresets(nextPresets: ProfilePresetEx[] = []) {
    presets = nextPresets;
    currentPresetIndex = -1;
}

function getPresetsKey(section: PresetSection, userId: string) {
    const baseKey = section === "main" ? MAIN_PRESETS_KEY : SERVER_PRESETS_KEY;
    return `${baseKey}:${userId}`;
}

function getLegacyKey(userId: string) {
    return `${LEGACY_PRESETS_KEY}:${userId}:main`;
}

export async function loadPresets(section: PresetSection) {
    const generation = ++loadGeneration;

    try {
        const currentUser = UserStore.getCurrentUser();
        if (!currentUser) {
            if (isStaleLoad(generation)) return;
            activeScopeKey = null;
            resetPresets();
            return;
        }

        const userId = currentUser.id;
        const key = getPresetsKey(section, userId);
        const stored = await DataStore.get(key);
        if (isStaleLoad(generation)) return;

        activeScopeKey = key;

        if (stored && Array.isArray(stored)) {
            resetPresets(stored);
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
                resetPresets(legacyToUse);
                await DataStore.set(key, legacyToUse);
                if (isStaleLoad(generation)) return;
                await DataStore.del(legacyKey);
                await DataStore.del(LEGACY_PRESETS_KEY);
                return;
            }
        }

        resetPresets();
    } catch (err) {
        if (isStaleLoad(generation)) return;
        logger.error("Failed to load presets", err);
        resetPresets();
    }
}

export async function savePresetsData(section?: PresetSection) {
    try {
        if (!activeScopeKey && !section) return;
        const currentUser = UserStore.getCurrentUser();
        if (!currentUser) return;
        const userId = currentUser.id;
        const key = section ? getPresetsKey(section, userId) : activeScopeKey!;
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
}
