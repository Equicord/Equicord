/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DataStore } from "@api/index";
import { Settings } from "@api/Settings";
import type { ProfilePreset } from "@vencord/discord-types";
import { showToast, Toasts } from "@webpack/common";

import { settings } from "../settings";
import type { PresetSection } from "./storage";
import { bindingKey, getBinding, getPinnedThemes, type ThemeBinding } from "./themeBindings";

const { VencordNative } = window;

const LAST_PRESET_CTX_KEY = "ProfileSets_LastPresetContext_v1";

type LastPresetContext = {
    section: PresetSection;
    guildId?: string;
    presetName: string;
};

type LoadPresetOptions = {
    isGuildProfile?: boolean;
};

export interface ThemeItem {
    name: string;
    id: string;
    type: "local" | "online";
}

interface ThemeFile {
    fileName: string;
}

let lastPresetTheme: ThemeBinding | null = null;

function bindingEquals(a: ThemeBinding, b: ThemeBinding) {
    return a.type === b.type && a.themeId === b.themeId;
}

function isPinned(binding: ThemeBinding) {
    return getPinnedThemes().some(p => bindingEquals(p, binding));
}

export async function getAvailableThemes(): Promise<ThemeItem[]> {
    const themes: ThemeItem[] = [];

    if (!IS_WEB) {
        const localThemes: ThemeFile[] = await VencordNative.themes.getThemesList();
        localThemes.forEach(({ fileName }) => {
            if (!fileName.endsWith(".css") || fileName === "source.theme.css") return;
            themes.push({
                name: Settings.themeNames?.[fileName] ?? fileName.replace(/\.css$/, ""),
                id: fileName,
                type: "local",
            });
        });
    }

    if (Settings.themeLinks) {
        Settings.themeLinks.forEach((link: string) => {
            const cleanLink = link.replace(/^@(?:light|dark)\s+/, "");
            const name =
                Settings.themeNames?.[cleanLink] ??
                cleanLink
                    .split("/")
                    .pop()
                    ?.replace(/\.css$/, "") ??
                cleanLink;
            themes.push({
                name,
                id: link,
                type: "online",
            });
        });
    }

    themes.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    return themes;
}

export function getLastPresetTheme() {
    return lastPresetTheme;
}

export function applyThemesWithPreset(presetBinding: ThemeBinding | null) {
    const pinned = getPinnedThemes();
    let local = pinned.filter(t => t.type === "local").map(t => t.themeId);
    let online = pinned.filter(t => t.type === "online").map(t => t.themeId);

    if (lastPresetTheme && !isPinned(lastPresetTheme)) {
        if (lastPresetTheme.type === "local") {
            local = local.filter(id => id !== lastPresetTheme!.themeId);
        } else {
            online = online.filter(id => id !== lastPresetTheme!.themeId);
        }
    }

    lastPresetTheme = presetBinding;

    if (presetBinding) {
        if (presetBinding.type === "local" && !local.includes(presetBinding.themeId)) {
            local.push(presetBinding.themeId);
        }
        if (presetBinding.type === "online" && !online.includes(presetBinding.themeId)) {
            online.push(presetBinding.themeId);
        }
    }

    Settings.enabledThemes = local;
    Settings.enabledThemeLinks = online;
}

export function applyPinnedThemesOnly() {
    applyThemesWithPreset(null);
}

/** Add pinned themes to the active list without removing other enabled themes. */
function ensurePinnedThemesEnabled() {
    const pinned = getPinnedThemes();
    if (!pinned.length) return;

    const local = [...(Settings.enabledThemes ?? [])];
    const online = [...(Settings.enabledThemeLinks ?? [])];

    for (const binding of pinned) {
        if (binding.type === "local") {
            if (!local.includes(binding.themeId)) local.push(binding.themeId);
        } else if (!online.includes(binding.themeId)) {
            online.push(binding.themeId);
        }
    }

    Settings.enabledThemes = local;
    Settings.enabledThemeLinks = online;
}

export function bindingMatchesActiveTheme(binding: ThemeBinding): boolean {
    if (binding.type === "local") {
        return Settings.enabledThemes?.includes(binding.themeId) ?? false;
    }
    return Settings.enabledThemeLinks?.includes(binding.themeId) ?? false;
}

export function themeItemToBinding(theme: ThemeItem): ThemeBinding {
    return {
        themeId: theme.id,
        type: theme.type,
        themeName: theme.name,
    };
}

async function saveLastPresetContext(section: PresetSection, guildId: string | undefined, presetName: string) {
    await DataStore.set(LAST_PRESET_CTX_KEY, { section, guildId, presetName });
}

export async function restoreActivePresetTheme() {
    const ctx = await DataStore.get(LAST_PRESET_CTX_KEY) as LastPresetContext | undefined;
    const hasPresetContext = Boolean(ctx?.presetName);
    const hasPinnedThemes = getPinnedThemes().length > 0;

    if (!hasPresetContext && !hasPinnedThemes) return;

    if (!settings.store.switchThemeOnLoad) {
        ensurePinnedThemesEnabled();
        return;
    }

    if (!hasPresetContext) {
        applyPinnedThemesOnly();
        return;
    }

    if (ctx.section === "server" && !settings.store.switchThemeForServerPresets) {
        applyPinnedThemesOnly();
        return;
    }

    const binding = getBinding(bindingKey(ctx.section, ctx.guildId, ctx.presetName));
    applyThemesWithPreset(binding);
}

export async function applyThemeForLoadedPreset(
    preset: ProfilePreset,
    guildId?: string,
    options: LoadPresetOptions = {}
) {
    if (!settings.store.switchThemeOnLoad) return;

    const isGuild = options.isGuildProfile ?? Boolean(guildId);
    if (isGuild && !settings.store.switchThemeForServerPresets) return;

    const section: PresetSection = isGuild ? "server" : "main";
    const binding = getBinding(bindingKey(section, guildId, preset.name));

    await saveLastPresetContext(section, guildId, preset.name);
    applyThemesWithPreset(binding);

    if (binding && settings.store.showThemeSwitchToast) {
        showToast(
            `Theme: ${binding.themeName ?? binding.themeId}`,
            Toasts.Type.SUCCESS
        );
    }
}
