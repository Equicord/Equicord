/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandOptionType, findOption } from "@api/Commands";
import { definePluginSettings } from "@api/Settings";
import { Devs, EquicordDevs } from "@utils/constants";
import { t } from "@utils/translation";
import definePlugin, { OptionType } from "@utils/types";

function getMessage(opts) {
    const inputOption = findOption(opts, "input", "");

    let queryURL = "" + searchEngines[settings.store.defaultEngine] + encodeURIComponent(inputOption);

    if (settings.store.customEngineURL) {
        queryURL = "" + [settings.store.customEngineURL] + encodeURIComponent(inputOption);
    }

    if (settings.store.hyperlink && !settings.store.embed) {
        return `[${inputOption}](<${queryURL}>)`;
    }
    else if (settings.store.hyperlink) {
        return `[${inputOption}](${queryURL})`;
    }
    else if (!settings.store.embed) {
        return `<${queryURL}>`;
    }
    else {
        return queryURL;
    }
}

const searchEngines = {
    "Google": "https://www.google.com/search?q=",
    "Bing": "https://www.bing.com/search?q=",
    "Yahoo": "https://search.yahoo.com/search?p=",
    "DuckDuckGo": "https://duckduckgo.com/?q=",
    "Baidu": "https://www.baidu.com/s?wd=",
    "Yandex": "https://yandex.com/search/?text=",
    "Ecosia": "https://www.ecosia.org/search?q=",
    "Ask": "https://www.ask.com/web?q=",
    "AOL": "https://search.aol.com/aol/search?q=",
    "LetMeGoogleThatForYou": "https://letmegooglethat.com/?q="
};

const settings = definePluginSettings({
    hyperlink: {
        type: OptionType.BOOLEAN,
        description: t("googleThat.settings.hyperlink"),
        default: false
    },
    embed: {
        type: OptionType.BOOLEAN,
        description: t("googleThat.settings.embed"),
        default: true
    },
    defaultEngine: {
        type: OptionType.SELECT,
        description: t("googleThat.settings.defaultEngine"),
        options: Object.keys(searchEngines).map((key, index) => ({
            label: key,
            value: key,
            default: index === 0
        }))
    },
    customEngineURL: {
        description: t("googleThat.settings.customEngineURL"),
        type: OptionType.STRING,
        placeholder: ""
    }
});

export default definePlugin({
    name: "GoogleThat",
    description: t("googleThat.description"),
    authors: [Devs.Samwich, EquicordDevs.KrystalSkull],
    tags: ["search", "google", "query", "duckduckgo", "command"],
    settings,
    commands: [
        {
            name: "googlethat",
            description: t("googleThat.commands.googlethat"),
            options: [
                {
                    name: "input",
                    description: t("googleThat.commands.input"),
                    type: ApplicationCommandOptionType.STRING,
                    required: true,
                }
            ],
            execute: opts => ({
                content: getMessage(opts)
            }),
        }
    ]
});
