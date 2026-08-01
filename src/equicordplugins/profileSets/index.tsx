/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { definePluginSettings } from "@api/Settings";
import { UserIcon } from "@components/Icons";
import SettingsPlugin from "@plugins/_core/settings";
import { EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { removeFromArray } from "@utils/misc";
import definePlugin, { OptionType } from "@utils/types";
import { SettingsRouter } from "@webpack/common";

import { loadPresets } from "./utils/storage";

export const cl = classNameFactory("vc-profile-presets-");
export const settings = definePluginSettings({
    avatarSize: {
        type: OptionType.SLIDER,
        description: "Avatar size in preset list.",
        markers: [56, 64, 72, 80, 88, 96],
        default: 56,
        stickToMarkers: true
    },
});

export default definePlugin({
    name: "ProfileSets",
    description: "Allows you to save and load different profile presets.",
    tags: ["Appearance", "Customisation", "Utility"],
    authors: [EquicordDevs.omaw, EquicordDevs.justjxke],
    settings,
    toolboxActions: {
        "Open Profile Sets": () => {
            SettingsRouter.openUserSettings("equicord_profile_sets_panel");
        },
    },

    start() {
        loadPresets("main");
        SettingsPlugin.customEntries.push({
            key: "equicord_profile_sets",
            title: "Profile Sets",
            Component: require("./components/profileSetsTab").default,
            Icon: UserIcon
        });
    },

    stop() {
        removeFromArray(SettingsPlugin.customEntries, e => e.key === "equicord_profile_sets");
    },
});
