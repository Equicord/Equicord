/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Paragraph } from "@components/Paragraph";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";

const settings = definePluginSettings({
    globalMention: {
        type: OptionType.BOOLEAN,
        description: "Mention users from any server, not just the current one",
        default: false,
        restartNeeded: true
    }
});

export default definePlugin({
    name: "UniversalMention",
    authors: [EquicordDevs.justjxke],
    description: "Mention any user, regardless of channel access.",
    settings,
    settingsAboutComponent: () => (
        <Paragraph className="plugin-warning">
            Using Global Mention can cause performance issues and show an absurd amount of users in the autocomplete.
        </Paragraph>
    ),

    patches: [
        {
            find: "queryChannelUsers({channelId:",
            replacement: {
                match: /filter:(\i)=>(\i)\.isPrivate\(\)\|\|(\i)\.BT\({permission:(\i)\.Plq\.VIEW_CHANNEL,user:\1,context:\2}\)/,
                replace: "filter:$1=>true",
            },
        },
        {
            find: "queryChannelUsers({channelId:",
            predicate: () => settings.store.globalMention,
            replacement: {
                match: /(t=)(\i)\.ZP\.getMembers\((\i)\.guild_id\)\.filter\((\i)\)/,
                replace: "$1Object.values(X.default.getUsers())"
            }
        }
    ],
});

// holy shit, a simple justjxke plugin? can't be real!
// well, not so simple anymore lmfao
