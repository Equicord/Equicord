/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import definePlugin, { makeRange, OptionType } from "@utils/types";
import { React } from "@webpack/common";

import { PresetManager } from "./components/presetManager";
import { loadPresets } from "./utils/storage";

export const cl = classNameFactory("vc-profile-presets-");
export const settings = definePluginSettings({
    avatarSize: {
        type: OptionType.SLIDER,
        description: "Avatar size in preset list.",
        default: 40,
        markers: makeRange(32, 96, 8),
        stickToMarkers: true
    },
});

export default definePlugin({
    name: "ProfileSets",
    description: "Allows you to save and load different profile presets, via the Profile Section in Settings.",
    authors: [EquicordDevs.omaw, EquicordDevs.justjxke],
    settings,
    patches: [
        {
            find: "DefaultCustomizationSections: user cannot be undefined",
            replacement: {
                match: /return.{0,50}children:\[(?<=\.getLegacyUsername\(\).*?)/,
                replace: "$&$self.renderPresetSection(),"
            }
        }
    ],
    start() {
        loadPresets();
    },
    renderPresetSection() {
        return <PresetManager />;
    }
});
