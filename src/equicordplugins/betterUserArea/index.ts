/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import { t } from "@utils/translation";
import definePlugin, { OptionType } from "@utils/types";

const settings = definePluginSettings({
    removeNameplate: {
        type: OptionType.BOOLEAN,
        description: t("betterUserArea.settings.removeNameplate"),
        default: true,
        restartNeeded: true
    },
    removeAudioMenus: {
        type: OptionType.BOOLEAN,
        description: t("betterUserArea.settings.removeAudioMenus"),
        default: true,
        restartNeeded: true
    },
    alwaysShowUsername: {
        type: OptionType.BOOLEAN,
        description: t("betterUserArea.settings.alwaysShowUsername"),
        default: true,
        restartNeeded: true
    },
    removeButtonTooltips: {
        type: OptionType.BOOLEAN,
        description: t("betterUserArea.settings.removeButtonTooltips"),
        default: false,
        restartNeeded: true
    },
    removeAvatarDecoration: {
        type: OptionType.BOOLEAN,
        description: t("betterUserArea.settings.removeAvatarDecoration"),
        default: true,
        restartNeeded: true
    },
    removeUsernameStyles: {
        type: OptionType.BOOLEAN,
        description: t("betterUserArea.settings.removeUsernameStyles"),
        default: true,
        restartNeeded: true
    }
});

export default definePlugin({
    name: "BetterUserArea",
    description: t("betterUserArea.description"),
    authors: [Devs.prism],
    settings,
    patches: [
        {
            find: "#{intl::ACCOUNT_SPEAKING_WHILE_MUTED}",
            replacement: {
                match: /,nameplate:\i,selectedGuildId:(\i),avatarDecoration/,
                replace: ",nameplate:null,selectedGuildId:$1,avatarDecoration"
            },
            predicate: () => settings.store.removeNameplate
        },
        {
            find: "#{intl::ACCOUNT_SPEAKING_WHILE_MUTED}",
            replacement: [
                {
                    match: /(?<=#{intl::MUTE}\),)className:\i\.\i,/,
                    replace: ""
                },
                {
                    match: /(?<=#{intl::DEAFEN}\),)className:\i\.\i,/,
                    replace: ""
                },
                {
                    match: /,\(0,\i\.jsxs?\)\(\i\.\i,\{.{0,600}#{intl::ACCOUNT_INPUT_OPTIONS}\)\}\)(?=\])/,
                    replace: ""
                },
                {
                    match: /,\(0,\i\.jsxs?\)\(\i\.\i,\{.{0,650}#{intl::ACCOUNT_OUTPUT_OPTIONS}\)\}\)(?=\])/,
                    replace: ""
                }
            ],
            predicate: () => settings.store.removeAudioMenus
        },
        {
            find: "#{intl::ACCOUNT_SPEAKING_WHILE_MUTED}",
            replacement: {
                match: /hoverText:(\i),forceHover:\i,children:/g,
                replace: "hoverText:$1,forceHover:!0,children:"
            },
            predicate: () => settings.store.alwaysShowUsername
        },
        {
            find: "#{intl::ACCOUNT_SPEAKING_WHILE_MUTED}",
            replacement: [
                {
                    match: /:\{tooltipText:\i\};/,
                    replace: ":{tooltipText:void 0};"
                },
                {
                    match: /(?<=role:"switch",)tooltipText:\i\}/,
                    replace: "tooltipText:void 0}"
                },
                {
                    match: /tooltipText:\i,tooltipPositionKey/,
                    replace: "tooltipText:void 0,tooltipPositionKey"
                }
            ],
            predicate: () => settings.store.removeButtonTooltips
        },
        {
            find: "#{intl::ACCOUNT_SPEAKING_WHILE_MUTED}",
            replacement: {
                match: /avatarDecoration:(.{0,70}),size:/,
                replace: "avatarDecoration:void 0,size:"
            },
            predicate: () => settings.store.removeAvatarDecoration
        },
        {
            find: "#{intl::ACCOUNT_SPEAKING_WHILE_MUTED}",
            replacement: {
                match: /displayNameStyles:(\i),/,
                replace: "displayNameStyles:void 0,"
            },
            predicate: () => settings.store.removeUsernameStyles
        }
    ],
});
