/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DataStore } from "@api/index";
import { Logger } from "@utils/Logger";

import type { PresetSection } from "./storage";

const logger = new Logger("ProfileSets");
const BINDINGS_KEY = "ProfileSets_ThemeBindings_v1";
const PINNED_THEMES_KEY = "ProfileSets_PinnedThemes_v1";
const LEGACY_LOCKED_THEME_KEY = "ProfileSets_LockedTheme_v1";

export type ThemeBinding = {
    themeId: string;
    type: "local" | "online";
    themeName?: string;
};

export type BindingMap = Record<string, ThemeBinding>;

let bindings: BindingMap = {};
let pinnedThemes: ThemeBinding[] = [];
let loaded = false;
let bindingsSaveInFlight = false;
let bindingsSavePending = false;

function bindingEquals(a: ThemeBinding, b: ThemeBinding) {
    return a.type === b.type && a.themeId === b.themeId;
}

export function pinnedThemeKey(binding: ThemeBinding): string {
    return `${binding.type}:${binding.themeId}`;
}

async function flushBindings() {
    bindingsSaveInFlight = true;
    try {
        do {
            bindingsSavePending = false;
            await DataStore.set(BINDINGS_KEY, bindings);
        } while (bindingsSavePending);
    } catch (err) {
        logger.error("Failed to save theme bindings", err);
    } finally {
        bindingsSaveInFlight = false;
        if (bindingsSavePending) {
            void flushBindings();
        }
    }
}

function persistBindings() {
    if (bindingsSaveInFlight) {
        bindingsSavePending = true;
        return;
    }
    void flushBindings();
}

async function persistPinnedThemes() {
    try {
        await DataStore.set(PINNED_THEMES_KEY, pinnedThemes);
    } catch (err) {
        logger.error("Failed to save pinned themes", err);
    }
}

export async function loadThemeBindings() {
    if (loaded) return;
    try {
        const [stored, storedPinned, legacyLocked] = await Promise.all([
            DataStore.get(BINDINGS_KEY),
            DataStore.get(PINNED_THEMES_KEY),
            DataStore.get(LEGACY_LOCKED_THEME_KEY),
        ]);
        bindings = stored && typeof stored === "object" ? stored as BindingMap : {};
        if (Array.isArray(storedPinned)) {
            pinnedThemes = storedPinned;
        } else if (legacyLocked && typeof legacyLocked === "object") {
            pinnedThemes = [legacyLocked as ThemeBinding];
            await persistPinnedThemes();
            await DataStore.del(LEGACY_LOCKED_THEME_KEY);
        } else {
            pinnedThemes = [];
        }
    } catch (err) {
        logger.error("Failed to load theme bindings", err);
        bindings = {};
        pinnedThemes = [];
    }
    loaded = true;
}

export function getPinnedThemes(): ThemeBinding[] {
    return [...pinnedThemes];
}

export function isThemePinned(binding: ThemeBinding): boolean {
    return pinnedThemes.some(p => bindingEquals(p, binding));
}

export function togglePinnedTheme(binding: ThemeBinding): boolean {
    const index = pinnedThemes.findIndex(p => bindingEquals(p, binding));
    if (index >= 0) {
        pinnedThemes.splice(index, 1);
        void persistPinnedThemes();
        return false;
    }
    pinnedThemes.push(binding);
    void persistPinnedThemes();
    return true;
}

export function setPinnedThemes(next: ThemeBinding[]) {
    pinnedThemes = next;
    void persistPinnedThemes();
}

export function bindingKey(section: PresetSection, guildId: string | undefined, presetName: string) {
    if (section === "server") {
        return `server:${guildId ?? "unknown"}:${presetName}`;
    }
    return `main:${presetName}`;
}

export function getBinding(key: string): ThemeBinding | null {
    return bindings[key] ?? null;
}

export function setBinding(key: string, binding: ThemeBinding | null) {
    if (binding == null) {
        delete bindings[key];
    } else {
        bindings[key] = binding;
    }
    void persistBindings();
}

export function renameBindingKey(
    section: PresetSection,
    guildId: string | undefined,
    oldName: string,
    newName: string
) {
    if (oldName === newName) return;
    const oldKey = bindingKey(section, guildId, oldName);
    const newKey = bindingKey(section, guildId, newName);
    const existing = bindings[oldKey];
    if (!existing) return;
    delete bindings[oldKey];
    bindings[newKey] = existing;
    void persistBindings();
}

export function deleteBindingForPreset(
    section: PresetSection,
    guildId: string | undefined,
    presetName: string
) {
    setBinding(bindingKey(section, guildId, presetName), null);
}

export function listBindings(): Array<{ key: string; binding: ThemeBinding; }> {
    return Object.entries(bindings).map(([key, binding]) => ({ key, binding }));
}
