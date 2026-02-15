/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import { t } from "@utils/translation";
import definePlugin, { OptionType } from "@utils/types";
import { UserSettingsActionCreators } from "@webpack/common";

function getMessage(opts, other) {
    const frecencyStore = UserSettingsActionCreators.FrecencyUserSettingsActionCreators.getCurrentValue();

    const gifsArray = Object.keys(frecencyStore.favoriteGifs.gifs);

    const chosenGifUrl = gifsArray[Math.floor(Math.random() * gifsArray.length)];

    let ownerPing = "";

    if (other.guild != null) {
        if (other.guild.ownerId != null && settings.store.pingOwnerChance && Math.random() <= 0.1) {
            ownerPing = `<@${other.guild.ownerId}>`;
        }
    }

    return `${chosenGifUrl} ${ownerPing}`;
}

const settings = definePluginSettings({
    pingOwnerChance: {
        type: OptionType.BOOLEAN,
        description: t("gifRoulette.settings.pingOwnerChance"),
        default: true
    }
});

export default definePlugin({
    name: "GifRoulette",
    description: t("gifRoulette.description"),
    authors: [Devs.Samwich],
    settings,
    commands: [
        {
            name: "gifroulette",
            description: t("gifRoulette.commands.gifroulette"),
            execute: (opts, other) => ({
                content: getMessage(opts, other)
            }),
        }
    ]
});
