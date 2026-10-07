/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Settings, useSettings } from "@api/Settings";
import { UserStore } from "@webpack/common";

import type { settings } from "./store";

export const QUESTIFY_PLUGIN_NAME = "Questify";

type QuestifySettings = typeof settings.store & Pick<Settings["plugins"][string], "enabled" | "isFavorite">;

export function getQuestifySettings(): QuestifySettings {
    return Settings.plugins[QUESTIFY_PLUGIN_NAME] as QuestifySettings;
}

export function useQuestifySettings<K extends keyof QuestifySettings & string>(keys: readonly K[]): Pick<QuestifySettings, K> {
    useSettings(keys.map(key => `plugins.${QUESTIFY_PLUGIN_NAME}.${key}`) as Parameters<typeof useSettings>[0]);
    return getQuestifySettings();
}

export function getCurrentUserId(): string | null {
    return UserStore.getCurrentUser()?.id ?? null;
}
