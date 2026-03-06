/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface MarkdownFormat {
    name: string;
    prefix: string;
    suffix: string;
    settingKey: string;
    lineLevel: boolean;
    toolbarIcon: string | null;
    toolbarLabel: string;
    defaultKeybind: string[];
}

export interface MarkdownShortcutsSettingsStore {
    enableToolbarButtons: boolean;
    enableShortcuts: boolean;
    [key: string]: boolean | string[];
}
