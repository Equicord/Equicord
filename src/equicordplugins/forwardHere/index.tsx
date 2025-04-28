/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { UserStore } from "@webpack/common";
import { Message } from "discord-types/general";

export default definePlugin({
    name: "ForwardHere",
    description: "Adds the current channel at the top of the Forward menu",
    authors: [Devs.Sqaaakoi],
    settings: definePluginSettings({
        selectedByDefault: {
            type: OptionType.BOOLEAN,
            description: "Selects the current channel in the forward menu by default",
            default: false
        },
        author: {
            type: OptionType.BOOLEAN,
            description: "Adds the author of the message to the forwarding menu",
            default: false
        }
    }),
    patches: [
        {
            find: ".ToastType.FORWARD",
            replacement: [
                // top of search results
                {
                    match: /(selectedDestinations:)(\i)(,originDestination:)(\i)/,
                    replace: "$1[$4,...($self.injectAuthor(arguments[0].message)),...$2]$3$4"
                },
                // select by default
                {
                    match: /(\[\i,\i]=\i\.useState\()(\i)(\).{0,200}?originDestination:)(\i)/,
                    replace: "$1$2.length<1&&$self.settings.store.selectedByDefault?[$4]:$2$3$4"
                }
            ]
        }
    ],
    injectAuthor(message: Message) {
        const userId = message.author.id;
        if (!this.settings.store.author || (UserStore.getCurrentUser().id === userId) || (message.webhookId && message.author.isNonUserBot())) return [];
        return [{ type: "user", id: userId }];
    }
});
