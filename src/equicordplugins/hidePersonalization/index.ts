/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/index";
import definePlugin, { OptionType } from "@utils/types";

export const settings = definePluginSettings({
    avatarDecoration: {
        type: OptionType.BOOLEAN,
        description: "Hide avatar decorations.",
        default: true,
        restartNeeded: true,
    },
    nameplate: {
        type: OptionType.BOOLEAN,
        description: "Hide nameplates.",
        default: true,
        restartNeeded: true,
    },
    profileEffect: {
        type: OptionType.BOOLEAN,
        description: "Hide profile animation effects on open.",
        default: true,
        restartNeeded: true,
    },
    clanTag: {
        type: OptionType.BOOLEAN,
        description: "Hide clan tags.",
        default: true,
        restartNeeded: true,
    },
});

export default definePlugin({
    name: "HidePersonalization",
    description: "Hides personalization features.",
    authors: [EquicordDevs.Leon135],
    settings,
    patches: [
        {
            // Avatar decoration
            find: "getAvatarDecorationURL:",
            replacement: {
                match: /function \i\(\i\)\{(?=.{0,10}avatarDecoration)/,
                replace: "$&return null;"
            },
            predicate: () => settings.store.avatarDecoration,
        },
        {
            // Nameplate
            find: "#{intl::AVATAR_MALLOW}",
            replacement: {
                match: /function \i\(\i\)\{(?=.{0,25}skuId:)/,
                replace: "$&return null;"
            },
            predicate: () => settings.store.nameplate,
        },
        {
            // Profile banner animation effect
            find: "bannerAdjustment,noBorderRadius",
            replacement: {
                match: /\i=\i=>\{(?=.{0,50}\.useReducedMotion\))/,
                replace: "$&return null;"
            },
            predicate: () => settings.store.profileEffect,
        },
        {
            // Clan tag
            find: ".GuildFeatures.GUILD_TAGS)",
            replacement: {
                match: /(?<=\.profile\?\.badge.{0,50}\i\)\{)/,
                replace: "return false;"
            }
        }
    ]
});
