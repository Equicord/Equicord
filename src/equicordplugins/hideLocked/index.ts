/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import type { Channel } from "@vencord/discord-types";
import { ChannelStore, PermissionsBits, PermissionStore } from "@webpack/common";

export default definePlugin({
    name: "HideLocked",
    description: "Hides users in locked voice channels from the server hover card.",
    authors: [EquicordDevs.omaw],
    requiresRestart: true,

    patches: [
        {
            find: "GuildTooltip - stageSpeakers",
            replacement: [
                {
                    // hide users and speakers in locked voice or stage channels
                    match: /if\((\i)===(\i)\.afkChannelId\)return\[\](?=;let \i=.{0,80}?\.map)/,
                    replace: "if($1===$2.afkChannelId||$self.isLockedChannelId($1))return[]",
                },
                {
                    // ignore locked stage audiences
                    match: /for\(let (\i) of (\i)\)(\i\+=\i\.A\.getParticipantCount\(\1,\i\.ip\.AUDIENCE\))/,
                    replace: "for(let $1 of $2)!$self.isLockedChannelId($1)&&($3)",
                },
                {
                    // hide streamers
                    match: /filter\((\i)=>\1\.guildId===(\i)\)\.map\(\i=>\i\.ownerId\)/,
                    replace: "filter($1=>$1.guildId===$2&&!$self.isLockedChannelId($1.channelId)).map($1=>$1.ownerId)",
                },
                {
                    // hide embedded activities in locked channels
                    match: /getEmbeddedActivitiesForGuild\((\i)\)\.flatMap\((\i)=>Array\.from\(\2\.userIds\)\)/,
                    replace: "getEmbeddedActivitiesForGuild($1).filter($2=>!$self.isLockedChannelId($2.channelId)).flatMap($2=>Array.from($2.userIds))",
                }
            ]
        }
    ],

    canShowChannel(channel: Channel | null) {
        if (!channel?.guild_id) return true;

        return PermissionStore.can(PermissionsBits.VIEW_CHANNEL, channel) && PermissionStore.can(PermissionsBits.CONNECT, channel);
    },

    isLockedChannelId(channelId: string) {
        return !this.canShowChannel(ChannelStore.getChannel(channelId) as Channel | null);
    }
});