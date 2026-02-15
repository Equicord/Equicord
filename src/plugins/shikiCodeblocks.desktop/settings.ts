/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
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
import { disableStyle, enableStyle } from "@api/Styles";
import { parseUrl } from "@utils/misc";
import { wordsFromPascal, wordsToTitle } from "@utils/text";
import { OptionType } from "@utils/types";
import { t } from "@utils/translation";

import { shiki } from "./api/shiki";
import { themes } from "./api/themes";
import deviconStyle from "./devicon.css?managed";
import { DeviconSetting, HljsSetting } from "./types";

const themeNames = Object.keys(themes) as (keyof typeof themes)[];

export type ShikiSettings = typeof settings.store;
export const settings = definePluginSettings({
    theme: {
        type: OptionType.SELECT,
        description: t("shikiCodeblocks.settings.theme"),
        options: themeNames.map(themeName => ({
            label: wordsToTitle(wordsFromPascal(themeName)),
            value: themes[themeName],
            default: themes[themeName] === themes.DarkPlus,
        })),
        onChange: shiki.setTheme,
    },
    customTheme: {
        type: OptionType.STRING,
        description: t("shikiCodeblocks.settings.customTheme"),
        placeholder: themes.MaterialCandy,
        onChange: value => {
            shiki.setTheme(value || settings.store.theme);
        },
    },
    tryHljs: {
        type: OptionType.SELECT,
        description: t("shikiCodeblocks.settings.tryHljs"),
        options: [
            {
                label: t("shikiCodeblocks.settings.tryHljsOptions.never"),
                value: HljsSetting.Never,
            },
            {
                label: t("shikiCodeblocks.settings.tryHljsOptions.preferShiki"),
                value: HljsSetting.Secondary,
                default: true,
            },
            {
                label: t("shikiCodeblocks.settings.tryHljsOptions.preferHljs"),
                value: HljsSetting.Primary,
            },
            {
                label: t("shikiCodeblocks.settings.tryHljsOptions.always"),
                value: HljsSetting.Always,
            },
        ],
    },
    useDevIcon: {
        type: OptionType.SELECT,
        description: t("shikiCodeblocks.settings.useDevIcon"),
        options: [
            {
                label: t("shikiCodeblocks.settings.useDevIconOptions.disabled"),
                value: DeviconSetting.Disabled,
            },
            {
                label: t("shikiCodeblocks.settings.useDevIconOptions.colorless"),
                value: DeviconSetting.Greyscale,
                default: true,
            },
            {
                label: t("shikiCodeblocks.settings.useDevIconOptions.colored"),
                value: DeviconSetting.Color,
            },
        ],
        onChange: (newValue: DeviconSetting) => {
            if (newValue === DeviconSetting.Disabled) disableStyle(deviconStyle);
            else enableStyle(deviconStyle);
        },
    },
    bgOpacity: {
        type: OptionType.SLIDER,
        description: t("shikiCodeblocks.settings.bgOpacity"),
        markers: [0, 20, 40, 60, 80, 100],
        default: 100,
        stickToMarkers: false,
        componentProps: {
            onValueRender: null, // Defaults to percentage
        },
    },
}, {
    theme: {
        disabled() { return !!this.store.customTheme; },
    },
    customTheme: {
        isValid(value) {
            if (!value) return true;
            const url = parseUrl(value);
            if (!url) return "Must be a valid URL";

            if (!url.pathname.endsWith(".json")) return "Must be a json file";

            return true;
        },
    }
});
