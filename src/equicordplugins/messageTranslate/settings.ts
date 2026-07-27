/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export const settings = definePluginSettings({
    targetLanguage: {
        type: OptionType.STRING,
        description: "Target language code for translations (e.g. en, es, fr, de, ja).",
        default: "en",
    },
    excludedLanguages: {
        type: OptionType.STRING,
        description: "Language codes to exclude from translation (e.g. en, es, fr, de, ja).",
        default: "en",
    },
    confidenceRequirement: {
        type: OptionType.SLIDER,
        description: "Minimum confidence (0 to 1) required to show a translation.",
        markers: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
        default: 0.8,
    },
    autoTranslate: {
        type: OptionType.BOOLEAN,
        description: "Automatically translate messages as they appear.",
        default: true,
    },
    skipOwnMessages: {
        type: OptionType.BOOLEAN,
        description: "Do not translate your own messages.",
        default: true,
    },
    skipBotMessages: {
        type: OptionType.BOOLEAN,
        description: "Do not translate bot messages.",
        default: false,
    },
    ignoredGuilds: {
        type: OptionType.STRING,
        description: "Comma-separated list of server IDs to not translate in.",
        default: "",
    },
    ignoredChannels: {
        type: OptionType.STRING,
        description: "Comma-separated list of channel IDs to not translate in.",
        default: "",
    },
    ignoredUsers: {
        type: OptionType.STRING,
        description: "Comma-separated list of user IDs to not translate.",
        default: "",
    },
    showIndicator: {
        type: OptionType.BOOLEAN,
        description: "Append a small (translated) indicator to translated messages.",
        default: true,
    },
    showOriginal: {
        type: OptionType.SELECT,
        description: "Show the original and translated text.",
        options: [
            {
                label: "Don't show original.",
                value: "no-orig",
                default: true,
            },
            {
                label: "Show original in subtext",
                value: "orig-in-subtext",
            },
            {
                label: "Show original message, translation in subtext",
                value: "trans-in-subtext",
            },
        ]
    },
});

function parseList(value: string, callback?: (s: string) => string): Set<string> {
    let list = value.split(",").map(s => s.trim()).filter(Boolean);

    if (callback) {
        list = list.map(callback);
    }

    return new Set(list);
}

export function getExcludedLanguages(): Set<string> {
    return parseList(settings.store.excludedLanguages, s => s.toLowerCase());
}

export function getIgnoredGuilds(): Set<string> {
    return parseList(settings.store.ignoredGuilds);
}

export function getIgnoredChannels(): Set<string> {
    return parseList(settings.store.ignoredChannels);
}

export function getIgnoredUsers(): Set<string> {
    return parseList(settings.store.ignoredUsers);
}
