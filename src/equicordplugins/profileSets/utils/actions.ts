/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { isNonNullish } from "@utils/guards";
import { Logger } from "@utils/Logger";
import { ProfilePreset } from "@vencord/discord-types";
import { findStoreLazy } from "@webpack";
import { showToast, Toasts } from "@webpack/common";

import { getCurrentProfile } from "./profile";
import { addPreset, movePresetInArray, presets, type ProfilePresetEx, removePreset, replaceAllPresets, savePresetsData, updatePreset } from "./storage";

const UserProfileSettingsStore = findStoreLazy("UserProfileSettingsStore");

function isImageInput(value: unknown): value is string | { imageUri: string; } {
    if (typeof value === "string") return value.length > 0;
    return typeof value === "object" && isNonNullish(value) && "imageUri" in value && typeof (value as { imageUri: unknown }).imageUri === "string";
}

function getFreshPendingAvatar(): string | null {
    const pending = UserProfileSettingsStore.getPendingChanges?.() ?? {};
    const pendingObj = pending as Record<string, unknown>;
    const selected = [pendingObj.pendingAvatar].find(isImageInput);
    if (!selected) return null;
    return typeof selected === "string" ? selected : selected.imageUri;
}

export async function savePreset(name: string) {
    const profile = await getCurrentProfile();
    const freshPendingAvatar = getFreshPendingAvatar();
    const effectiveAvatar = freshPendingAvatar ?? profile.avatarDataUrl ?? null;

    const newPreset: ProfilePresetEx = {
        name,
        timestamp: Date.now(),
        ...profile,
        avatarDataUrl: effectiveAvatar,
    };
    addPreset(newPreset);
    await savePresetsData();
}

export async function updatePresetField<K extends keyof Omit<ProfilePreset, "name" | "timestamp">>(
    index: number,
    field: K,
    value: Omit<ProfilePreset, "name" | "timestamp">[K],
) {
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
    removePreset(index);
    await savePresetsData();
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
}

export function exportPresets() {
    const dataStr = JSON.stringify(presets, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `profiles-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
}

export type ImportDecision = "override" | "merge" | "cancel";

export async function importPresets(
    forceUpdate: () => void,
    onImportPrompt: (existingCount: number) => Promise<ImportDecision>,
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

            if (!Array.isArray(importedPresets)) return;

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

            await savePresetsData();
            forceUpdate();
        } catch (err) {
            new Logger("ProfilePresets").error("Failed to import presets", err);
            showToast("Failed to import presets. The file might be invalid.", Toasts.Type.FAILURE);
        }
    };
    input.click();
}
