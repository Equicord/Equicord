/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DataStore } from "@api/index";
import { Logger } from "@utils/Logger";
import { ProfilePreset } from "@vencord/discord-types";

const logger = new Logger("ProfilePresets");
const PRESETS_KEY = "ProfileDataset";

export let presets: ProfilePreset[] = [];
export let currentPresetIndex = -1;

export async function loadPresets() {
    try {
        const stored = await DataStore.get(PRESETS_KEY);
        if (stored && Array.isArray(stored)) {
            presets = stored;
        }
    } catch (err) {
        logger.error("Failed to load presets", err);
        presets = [];
    }
}

export async function savePresetsData() {
    try {
        await DataStore.set(PRESETS_KEY, presets);
    } catch (err) {
        logger.error("Failed to save presets", err);
    }
}

export function setCurrentPresetIndex(index: number) {
    currentPresetIndex = index;
}

export function addPreset(preset: ProfilePreset) {
    presets.push(preset);
}

export function updatePreset(index: number, preset: ProfilePreset) {
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

export function replaceAllPresets(newPresets: ProfilePreset[]) {
    presets = newPresets;
}
