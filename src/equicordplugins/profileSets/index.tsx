/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import definePlugin, { OptionType } from "@utils/types";
import { React, UserStore } from "@webpack/common";

import { PresetManager } from "./components/presetManager";

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
    name: "Profiles",
    description: "Save and load profile presets directly from your profile modal.",
    tags: ["Appearance", "Customisation", "Utility"],
    authors: [EquicordDevs.Jahbas, EquicordDevs.omaw, EquicordDevs.justjxke],
    settings,
    patches: [
        {
            find: "#{intl::USER_PROFILE_ACTIVITY}",
            replacement: {
                match: /(\i)\.id!==\i\?\.id&&\i&&\(.{0,300}\.MUTUAL_GUILDS\}\)\)(?=,(\i))/,
                replace: '$&,$self.pushProfilesTab($1.id,$2)',
            }
        },
        {
            find: ".WIDGETS?",
            replacement: {
                match: /(\i)===\i\.\i\.WISHLIST/,
                replace: '$1==="PROFILES"?$self.renderProfilesTab(arguments[0]):$&',
            }
        }
    ],
    start() {}
    pushProfilesTab(userId: string, sections: { push: (entry: { text: string; section: string; }) => void; }) {
        if (userId !== UserStore.getCurrentUser()?.id) return;
        sections.push({ text: "Profiles", section: "PROFILES" });
    },
    renderProfilesTab: ErrorBoundary.wrap((props: { user: { id: string; }; }) => {
        return <PresetManager userId={props.user.id} />;
    }, { noop: true }),
});
