/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addMessagePreSendListener, MessageSendListener, removeMessagePreSendListener } from "@api/MessageEvents";
import { definePluginSettings } from "@api/Settings";
import { Devs, EquicordDevs } from "@utils/constants";
import { t } from "@utils/translation";
import definePlugin, { OptionType } from "@utils/types";

const settings = definePluginSettings(
    {
        blockedWords: {
            type: OptionType.STRING,
            description: "Strings not to capitilise (seperate with a comma)",
            default: "http, https, ok"
        }
    }
);

const presendObject: MessageSendListener = (_, msg) => {
    const blockedWordsArray: string[] = settings.store.blockedWords.split(", ");
    const sentences = msg.content.split(/(?<=[.!?]+['")\]]*)(\s+)/);

    msg.content = sentences.map((element, i) => {
        if (i % 2 === 1) return element;

        if (!blockedWordsArray.some(word => element.toLowerCase().startsWith(word.toLocaleLowerCase()))) {
            return element.charAt(0).toUpperCase() + element.slice(1);
        } else {
            return element;
        }
    }).join("");
};

export default definePlugin({
    name: "WriteUpperCase",
    description: t("writeUpperCase.description"),
    authors: [Devs.Samwich, EquicordDevs.KrystalSkull],
    settings,

    start() {
        addMessagePreSendListener(presendObject);
    },
    stop() {
        removeMessagePreSendListener(presendObject);
    }
});
