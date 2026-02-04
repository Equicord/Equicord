/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ProfilePreset } from "@vencord/discord-types";
import { showToast, Toasts } from "@webpack/common";

import { getCurrentProfile } from "./profile";
import { addPreset, movePresetInArray, presets, removePreset, replaceAllPresets, savePresetsData, updatePreset } from "./storage";

export async function savePreset(name: string, guildId?: string) {
    const profile = await getCurrentProfile(guildId);
    const newPreset: ProfilePreset = {
        name,
        timestamp: Date.now(),
        ...profile,
    };
    addPreset(newPreset);
    await savePresetsData();
    showToast(`Profile "${name}" saved successfully`, Toasts.Type.SUCCESS);
}

export async function updatePresetField(index: number, field: keyof Omit<ProfilePreset, "name" | "timestamp">, value: any) {
    if (index < 0 || index >= presets.length) return;

    const updatedPreset = {
        ...presets[index],
        [field]: value,
        timestamp: Date.now()
    };
    updatePreset(index, updatedPreset);
    await savePresetsData();
}

export async function deletePreset(index: number) {
    if (index < 0 || index >= presets.length) return;

    const preset = presets[index];
    removePreset(index);
    await savePresetsData();
    showToast(`Profile "${preset.name}" deleted`, Toasts.Type.MESSAGE);
}

export async function movePreset(fromIndex: number, toIndex: number) {
    if (fromIndex < 0 || fromIndex >= presets.length || toIndex < 0 || toIndex >= presets.length) return;

    movePresetInArray(fromIndex, toIndex);
    await savePresetsData();
}

export async function renamePreset(index: number, newName: string) {
    if (index < 0 || index >= presets.length || !newName.trim()) return;

    const updatedPreset = { ...presets[index], name: newName.trim() };
    updatePreset(index, updatedPreset);
    await savePresetsData();
    showToast(`Profile renamed to "${newName}"`, Toasts.Type.SUCCESS);
}

export function exportPresets() {
    try {
        const dataStr = JSON.stringify(presets, null, 2);
        const dataBlob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `profile-presets-${Date.now()}.json`;
        link.click();
        URL.revokeObjectURL(url);
        showToast("Profiles exported successfully", Toasts.Type.SUCCESS);
    } catch (err) {
        showToast("Failed to export profiles", Toasts.Type.FAILURE);
    }
}

function presetsAreEqual(preset1: ProfilePreset, preset2: ProfilePreset): boolean {
    return preset1.avatarDataUrl === preset2.avatarDataUrl &&
        preset1.bannerDataUrl === preset2.bannerDataUrl &&
        preset1.bio === preset2.bio &&
        preset1.pronouns === preset2.pronouns &&
        JSON.stringify(preset1.themeColors) === JSON.stringify(preset2.themeColors) &&
        JSON.stringify(preset1.avatarDecoration) === JSON.stringify(preset2.avatarDecoration) &&
        JSON.stringify(preset1.profileEffect) === JSON.stringify(preset2.profileEffect) &&
        JSON.stringify(preset1.nameplate) === JSON.stringify(preset2.nameplate);
}

export async function importPresets(forceUpdate: () => void, onOverridePrompt: () => Promise<boolean>) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async (e: any) => {
        try {
            const file = e.target.files[0];
            if (!file) return;

            const text = await file.text();
            const importedPresets = JSON.parse(text);

            if (!Array.isArray(importedPresets)) {
                showToast("Invalid profile file format", Toasts.Type.FAILURE);
                return;
            }

            if (presets.length > 0) {
                const hasDuplicates = importedPresets.some(imported =>
                    presets.some(existing => presetsAreEqual(imported, existing))
                );

                if (hasDuplicates) {
                    const shouldOverride = await onOverridePrompt();
                    if (shouldOverride) {
                        replaceAllPresets(importedPresets);
                    } else {
                        const combined = [...presets, ...importedPresets];
                        replaceAllPresets(combined);
                    }
                } else {
                    const combined = [...presets, ...importedPresets];
                    replaceAllPresets(combined);
                }
            } else {
                replaceAllPresets(importedPresets);
            }

            await savePresetsData();
            forceUpdate();
            showToast(`Imported ${importedPresets.length} profiles successfully`, Toasts.Type.SUCCESS);
        } catch (err) {
            showToast("Failed to import profiles", Toasts.Type.FAILURE);
        }
    };
    input.click();
}
