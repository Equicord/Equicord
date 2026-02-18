/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import definePlugin, { OptionType } from "@utils/types";
import { FluxDispatcher, React } from "@webpack/common";

import { PresetManager } from "./components/presetManager";
import { loadPresets, PresetSection } from "./utils/storage";

export const cl = classNameFactory("vc-profile-presets-");

const displayNameStylesSanitizer = (payload: Record<string, unknown>) => {
    const styles = payload.displayNameStyles as Record<string, unknown> | null | undefined;
    if (styles == null || typeof styles !== "object") return;

    const fontId = styles.fontId ?? styles.font_id;
    const effectId = styles.effectId ?? styles.effect_id;
    const invalid =
        typeof fontId !== "number"
        || typeof effectId !== "number"
        || !Number.isFinite(fontId)
        || !Number.isFinite(effectId)
        || fontId <= 0
        || effectId <= 0;

    if (!invalid) return;

    const guildId = payload.guildId as string | undefined;
    FluxDispatcher.dispatch({
        type: "USER_PROFILE_SETTINGS_SET_PENDING_DISPLAY_NAME_STYLES",
        ...(guildId ? { guildId } : {}),
        displayNameStyles: null
    });
};
export const settings = definePluginSettings({
    avatarSize: {
        type: OptionType.NUMBER,
        description: "Avatar size in preset list.",
        default: 40,
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
                replace: "$&$self.renderPresetSection(\"main\"),"
            }
        },
        {
            find: "USER_SETTINGS_GUILD_PROFILE)",
            replacement: {
                match: /guildId:([^,]+),onChange:(\i)\}\)(?=.{0,25}profilePreviewTitle:)/,
                replace: 'guildId:$1,onChange:$2}),$self.renderPresetSection("server",$1)'
            }
        }
    ],
    start() {
        loadPresets("main");
        FluxDispatcher.subscribe("USER_PROFILE_SETTINGS_SET_PENDING_DISPLAY_NAME_STYLES", displayNameStylesSanitizer);
    },
    stop() {
        FluxDispatcher.unsubscribe("USER_PROFILE_SETTINGS_SET_PENDING_DISPLAY_NAME_STYLES", displayNameStylesSanitizer);
    },
    renderPresetSection(section: PresetSection, guildId?: string) {
        return <PresetManager section={section} guildId={guildId} />;
    }
});
