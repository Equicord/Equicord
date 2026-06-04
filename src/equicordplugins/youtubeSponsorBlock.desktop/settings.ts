/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

import type { Category, CategoryAction, CategorySetting } from "./types";

export const categorySettings = [
    ["sponsor", "sponsorAction"],
    ["selfpromo", "selfPromoAction"],
    ["interaction", "interactionAction"],
    ["intro", "introAction"],
    ["outro", "outroAction"],
    ["preview", "previewAction"],
    ["hook", "hookAction"],
    ["filler", "tangentsJokesAction"],
    ["music_offtopic", "musicOfftopicAction"]
] as const satisfies readonly (readonly [Category, CategorySetting])[];

const defaultActionOptions = [
    { label: "Skip automatically", value: "skip", default: true },
    { label: "Show in progress bar", value: "progress" },
    { label: "Manual skip button", value: "manual" },
    { label: "None", value: "none" }
] as const;
const disabledActionOptions = [
    { label: "Skip automatically", value: "skip" },
    { label: "Show in progress bar", value: "progress" },
    { label: "Manual skip button", value: "manual" },
    { label: "None", value: "none", default: true }
] as const;

export const settings = definePluginSettings({
    sponsorAction: {
        type: OptionType.SELECT,
        description: "Sponsor segments.",
        options: defaultActionOptions
    },
    selfPromoAction: {
        type: OptionType.SELECT,
        description: "Unpaid/self promotion segments.",
        options: defaultActionOptions
    },
    interactionAction: {
        type: OptionType.SELECT,
        description: "Interaction reminder segments.",
        options: defaultActionOptions
    },
    introAction: {
        type: OptionType.SELECT,
        description: "Intro segments.",
        options: disabledActionOptions
    },
    outroAction: {
        type: OptionType.SELECT,
        description: "Endcard and credits segments.",
        options: disabledActionOptions
    },
    previewAction: {
        type: OptionType.SELECT,
        description: "Preview and recap segments.",
        options: disabledActionOptions
    },
    hookAction: {
        type: OptionType.SELECT,
        description: "Hook and greeting segments.",
        options: disabledActionOptions
    },
    tangentsJokesAction: {
        type: OptionType.SELECT,
        description: "Tangents and jokes segments.",
        options: disabledActionOptions
    },
    musicOfftopicAction: {
        type: OptionType.SELECT,
        description: "Non-music sections in music videos.",
        options: disabledActionOptions
    }
});

export function getCategoryAction(category: Category): CategoryAction {
    const setting = categorySettings.find(([candidate]) => candidate === category)?.[1];
    return setting ? settings.store[setting] as CategoryAction : "none";
}

export function getEnabledCategories() {
    return categorySettings
        .filter(([, setting]) => settings.store[setting] !== "none")
        .map(([category]) => category);
}
