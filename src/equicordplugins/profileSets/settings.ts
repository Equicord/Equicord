/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

import { BindingSettings } from "./components/bindingSettings";

export const settings = definePluginSettings({
    avatarSize: {
        type: OptionType.SLIDER,
        description: "Avatar size in preset list.",
        markers: [56, 64, 72, 80, 88, 96],
        default: 56,
        stickToMarkers: true
    },
    switchThemeOnLoad: {
        type: OptionType.BOOLEAN,
        description: "Switch Equicord theme when a preset is clicked",
        default: true,
    },
    switchThemeForServerPresets: {
        type: OptionType.BOOLEAN,
        description: "Also switch themes for server-profile presets",
        default: true,
    },
    showThemeSwitchToast: {
        type: OptionType.BOOLEAN,
        description: "Show a toast when a preset theme is applied",
        default: true,
    },
    themeBindingList: {
        type: OptionType.COMPONENT,
        component: BindingSettings,
    },
});
