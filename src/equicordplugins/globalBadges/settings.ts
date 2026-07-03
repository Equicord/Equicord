/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export const settings = definePluginSettings({
    showPrefix: {
        type: OptionType.BOOLEAN,
        description: "Shows the Mod as Prefix",
        default: true,
        restartNeeded: false,
        onChange: (e => {
            if (e && settings.store.showSuffix) {
                settings.store.showSuffix = false;
            }
        })
    },
    showSuffix: {
        type: OptionType.BOOLEAN,
        description: "Shows the Mod as Suffix",
        default: false,
        restartNeeded: false,
        onChange: (e => {
            if (e && settings.store.showPrefix) {
                settings.store.showPrefix = false;
            }
        })
    },
    showCustom: {
        type: OptionType.BOOLEAN,
        description: "Show Custom Badges",
        default: true,
        restartNeeded: false
    },
    showNekocord: {
        type: OptionType.BOOLEAN,
        description: "Show Nekocord Badges",
        default: true,
        restartNeeded: false
    },
    showReviewDB: {
        type: OptionType.BOOLEAN,
        description: "Show ReviewDB Badges",
        default: true,
        restartNeeded: false
    },
    showAero: {
        type: OptionType.BOOLEAN,
        description: "Show Aero Badges",
        default: true,
        restartNeeded: false
    },
    showAliucord: {
        type: OptionType.BOOLEAN,
        description: "Show Aliucord Badges",
        default: true,
        restartNeeded: false
    },
    showRaincord: {
        type: OptionType.BOOLEAN,
        description: "Show Raincord Badges",
        default: true,
        restartNeeded: false
    },
    showVelocity: {
        type: OptionType.BOOLEAN,
        description: "Show Velocity Badges",
        default: true,
        restartNeeded: false
    },
    showEnmity: {
        type: OptionType.BOOLEAN,
        description: "Show Enmity Badges",
        default: true,
        restartNeeded: false
    },
    showPaicord: {
        type: OptionType.BOOLEAN,
        description: "Show Paicord Badges",
        default: true,
        restartNeeded: false
    },
    showBunny: {
        type: OptionType.BOOLEAN,
        description: "Show Bunny Badges",
        default: true,
        restartNeeded: false
    },
    showGooseMod: {
        type: OptionType.BOOLEAN,
        description: "Show GooseMod Badges",
        default: true,
        restartNeeded: false
    },
    showReplugged: {
        type: OptionType.BOOLEAN,
        description: "Show Replugged Badges",
        default: true,
        restartNeeded: false
    },
    showBetterDiscord: {
        type: OptionType.BOOLEAN,
        description: "Show BetterDiscord Badges",
        default: true,
        restartNeeded: false
    },
    showVendroidEnhanced: {
        type: OptionType.BOOLEAN,
        description: "Show Vendroid Enhanced Badges",
        default: true,
        restartNeeded: false
    },
    showRevenge: {
        type: OptionType.BOOLEAN,
        description: "Show Revenge Badges",
        default: true,
        restartNeeded: false
    },
    showReCord: {
        type: OptionType.BOOLEAN,
        description: "Show ReCord Badges",
        default: true,
        restartNeeded: false
    },
    apiUrl: {
        type: OptionType.STRING,
        description: "API to use",
        default: "https://badges.equicord.org/",
        restartNeeded: false,
        isValid: (value => {
            if (!value) return false;
            return true;
        })
    }
});
