/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import { t } from "@utils/translation";
import definePlugin, { OptionType } from "@utils/types";

export const settings = definePluginSettings({
    dms: {
        type: OptionType.BOOLEAN,
        default: true,
        description: t("anammox.settings.dms"),
        restartNeeded: true,
    },
    quests: {
        type: OptionType.BOOLEAN,
        default: false,
        description: t("anammox.settings.quests"),
        restartNeeded: true,
    },
    serverBoost: {
        type: OptionType.BOOLEAN,
        default: true,
        description: t("anammox.settings.serverBoost"),
        restartNeeded: true,
    },
    billing: {
        type: OptionType.BOOLEAN,
        default: true,
        description: t("anammox.settings.billing"),
        restartNeeded: true,
    },
    gift: {
        type: OptionType.BOOLEAN,
        default: true,
        description: t("anammox.settings.gift"),
        restartNeeded: true,
    },
    emojiList: {
        type: OptionType.BOOLEAN,
        default: true,
        description: t("anammox.settings.emojiList"),
        restartNeeded: true,
    },
});

export default definePlugin({
    name: "Anammox",
    description: t("anammox.description"),
    authors: [Devs.Kyuuhachi],
    settings,

    patches: [
        {
            // Above DMs, mouse nav
            find: 'tutorialId:"direct-messages"',
            replacement: [
                {
                    match: /"nitro-tab-group"\)/,
                    replace: "$&&&undefined",
                    predicate: () => settings.store.dms
                },
                {
                    match: /"discord-shop"\)/,
                    replace: "$&&&undefined",
                    predicate: () => settings.store.dms
                },
                {
                    match: /"quests"\)/,
                    replace: "$&&&undefined",
                    predicate: () => settings.store.quests
                },
            ],
        },
        {
            // Above DMs, keyboard nav
            find: ".hasLibraryApplication()&&!",
            replacement: [
                {
                    match: /\i\.\i\.APPLICATION_STORE,/,
                    replace: "/*$&*/",
                },
                {
                    match: /\i\.\i\.COLLECTIBLES_SHOP,/,
                    replace: "/*$&*/",
                },
            ],
            predicate: () => settings.store.dms,
        },
        {
            // Channel list server boost progress bar
            find: "useGuildActionRow",
            replacement: {
                match: /(GUILD_NEW_MEMBER_ACTIONS_PROGRESS_BAR\)):(\i(?:\.premiumProgressBarEnabled)?)/,
                replace: "$1:null"
            },
            predicate: () => settings.store.serverBoost,
        },
        {
            // Settings, sidebar
            find: ".BILLING_SECTION,",
            replacement: {
                match: /(?<=buildLayout:\(\)=>)\[.+?\]/,
                replace: "[]",
            },
            predicate: () => settings.store.billing,
        },
        {
            // Gift button
            find: '"sticker")',
            replacement: {
                match: /&&\i\.push\(\([^&]*?,"gift"\)\)/,
                replace: "",
            },
            predicate: () => settings.store.gift,
        },
        {
            // Emoji list
            find: "#{intl::EMOJI_PICKER_EXPAND_EMOJI_SECTION}),size:",
            replacement: {
                match: /(\i)=\i\|\|!\i&&\i.\i.isEmojiCategoryNitroLocked\(\{[^}]*\}\);/,
                replace: "$&$1||"
            },
            predicate: () => settings.store.emojiList,
        },
        {
            // Emoji category list
            find: "#{intl::EMOJI_CATEGORY_TOP_GUILD_EMOJI},{guildName:",
            replacement: {
                match: /(?<=(\i)\.unshift\((\i)\):)(?=\1\.push\(\2\))/,
                replace: "$2.isNitroLocked||"
            },
            predicate: () => settings.store.emojiList,
        }
    ],
});
