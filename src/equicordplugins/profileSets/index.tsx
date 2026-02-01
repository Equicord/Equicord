/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { React } from "@webpack/common";

import { PresetManager } from "./components/presetManager";
import { loadPresets } from "./utils/storage";

export const settings = definePluginSettings({
    avatarSize: {
        type: OptionType.SLIDER,
        description: "Avatar size in preset list.",
        default: 40,
        markers: [32, 40, 48, 56, 64],
        stickToMarkers: true
    },
});

export default definePlugin({
    name: "ProfileSets",
    description: "Allows you to save and load different profile presets, via the Profile Section in Settings.",
    authors: [EquicordDevs.omaw, EquicordDevs.justjxke], // dragify before gta6 when?!?!
    settings,
    start() {
        loadPresets();
    },
    patches: [
        {
            find: "DefaultCustomizationSections: user cannot be undefined",
            replacement: {
                match: /(return\(0,r\.jsxs\)\("div",\{className:\w+\.\w+,children:\[)/,
                replace: "$1$self.renderPresetSection(),"
            }
        }
    ],
    renderPresetSection() {
        return <PresetManager />;
    }
});