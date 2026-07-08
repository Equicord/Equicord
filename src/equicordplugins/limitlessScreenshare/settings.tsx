/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

import { SettingsPresetList } from "./SettingsPresetList";

// 0 FPS freezes (obviously) and anything less than 3p doesn't work
export const COOLDOWN_MS = 1000;
export const MIN_FPS = 1;
export const MIN_RESOLUTION = 3;

export const settings = definePluginSettings({
    maxFPS: {
        description: "Max FPS for the range slider",
        default: 120,
        type: OptionType.NUMBER,
        isValid: (value: number) => value >= MIN_FPS
    },
    fpsComponent: {
        type: OptionType.COMPONENT,
        component: () => SettingsPresetList(false)
    },
    maxResolution: {
        description: "Max Resolution for the range slider",
        default: 1080,
        type: OptionType.NUMBER,
        isValid: (value: number) => {
            if (value < MIN_RESOLUTION) return `Max resolution cannot be lower than ${MIN_RESOLUTION}`;
            if (value % (settings.store.roundResolution ? 10 : 1) !== 0) return "Max resolution must end with 0 if Round Resolution is on";
            return true;
        }
    },
    resolutionComponent: {
        type: OptionType.COMPONENT,
        component: () => SettingsPresetList(true)
    },
    roundResolution: {
        description: "Round resolution to the nearest 10p",
        default: false,
        type: OptionType.BOOLEAN
    },
    resolutions: {
        type: OptionType.CUSTOM,
        description: "",
        hidden: true,
        default: [{ label: "480p", value: 480 }, { label: "720p", value: 720 }, { label: "1080p", value: 1080 }, { label: "1440p", value: 1440 }, { label: "Source", value: 0 }],
    },
    fpss: {
        type: OptionType.CUSTOM,
        description: "",
        hidden: true,
        default: [{ label: "15fps", value: 15 }, { label: "30fps", value: 30 }, { label: "60fps", value: 60 }],
    },
});
