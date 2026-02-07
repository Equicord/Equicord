/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ProfilePreset } from "@vencord/discord-types";

import { getCurrentProfile } from "./profile";
import { addPreset, movePresetInArray, PresetSection, presets, removePreset, replaceAllPresets, savePresetsData, updatePreset, type ProfilePresetEx } from "./storage";

export async function savePreset(name: string, section: PresetSection, guildId?: string) {
    const profile = await getCurrentProfile(guildId, { isGuildProfile: section === "server" });
    const newPreset: ProfilePresetEx = {
        name,
        timestamp: Date.now(),
        ...profile,
    };
    addPreset(newPreset);
    await savePresetsData(section);
}

export async function updatePresetField(index: number, field: keyof Omit<ProfilePreset, "name" | "timestamp">, value: any, section: PresetSection, guildId?: string) {
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

    removePreset(index);
    await savePresetsData(section);
}

export async function movePreset(fromIndex: number, toIndex: number, section: PresetSection, guildId?: string) {
    if (fromIndex < 0 || fromIndex >= presets.length || toIndex < 0 || toIndex >= presets.length) return;

    movePresetInArray(fromIndex, toIndex);
    await savePresetsData(section);
}

export async function renamePreset(index: number, newName: string, section: PresetSection, guildId?: string) {
    if (index < 0 || index >= presets.length || !newName.trim()) return;

    const updatedPreset = { ...presets[index], name: newName.trim() };
    updatePreset(index, updatedPreset);
    await savePresetsData(section);
}

export function exportPresets(section: PresetSection) {
    try {
        const dataStr = JSON.stringify(presets, null, 2);
        const dataBlob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `profile-presets-${section}-${Date.now()}.json`;
        link.click();
        URL.revokeObjectURL(url);
    } catch {
    }
}

export type ImportDecision = "override" | "merge" | "cancel";

export async function importPresets(
    forceUpdate: () => void,
    onImportPrompt: (existingCount: number) => Promise<ImportDecision>,
    section: PresetSection,
    guildId?: string
) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async (event: Event) => {
        try {
            const target = event.currentTarget as HTMLInputElement | null;
            const file = target?.files?.[0];
            if (!file) return;

            const text = await file.text();
            const importedPresets = JSON.parse(text);

            if (!Array.isArray(importedPresets)) {
                return;
            }

            if (presets.length > 0) {
                const decision = await onImportPrompt(presets.length);
                if (decision === "cancel") return;
                if (decision === "override") {
                    replaceAllPresets(importedPresets);
                } else {
                    const combined = [...presets, ...importedPresets];
                    replaceAllPresets(combined);
                }
            } else {
                replaceAllPresets(importedPresets);
            }

            await savePresetsData(section);
            forceUpdate();
        } catch {
        }
    };
    input.click();
}
