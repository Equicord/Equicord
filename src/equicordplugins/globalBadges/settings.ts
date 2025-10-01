/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";


export const settings = definePluginSettings({
    showPrefix: {
        type: OptionType.BOOLEAN,
        description: "Shows the Mod as Prefix",
        default: true,
        restartNeeded: false
    },
    showSuffix: {
        type: OptionType.BOOLEAN,
        description: "Shows the Mod as Suffix",
        default: false,
        restartNeeded: false
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
    showRa1ncord: {
        type: OptionType.BOOLEAN,
        description: "Show Ra1ncord Badges",
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
    showReplugged: {
        type: OptionType.BOOLEAN,
        description: "Show Replugged Badges",
        default: true,
        restartNeeded: false
    }
});
