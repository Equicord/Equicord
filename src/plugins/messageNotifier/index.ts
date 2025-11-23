/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Notifications } from "@api/index";
import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import { getCurrentChannel } from "@utils/discord";
import definePlugin, { OptionType } from "@utils/types";
import { MessageJSON } from "@vencord/discord-types";
import { MessageType } from "@vencord/discord-types/enums";
import { ChannelStore, GuildStore, NavigationRouter, RelationshipStore, UserStore } from "@webpack/common";

interface MessageCreatePayload {
    guildId: string;
    channelId: string;
    message: MessageJSON;
}

const settings = definePluginSettings({
    users: {
        type: OptionType.STRING,
        description: "comma separated list of user ids to get message toasts for",
        default: "",
        isValid(value: string) {
            if (value === "") return true;
            const userIds = value.split(/, ?/);
            for (const id of userIds)
                if (!/\d+/.test(id)) return `${id} isn't a valid user id`;
            return true;
        },
    },
});

export default definePlugin({
    authors: [EquicordDevs.cassie, EquicordDevs.mochienya],
    name: "MessageNotifier",
    description: "Get toasts for when chosen users send a message",
    settings,
    flux: {
        MESSAGE_CREATE(payload: MessageCreatePayload) {
            if (payload.message.type !== MessageType.DEFAULT) return;
            if (getCurrentChannel()?.id === payload.channelId) return;

            const userIds = settings.store.users.split(/, ?/);
            if (!userIds.includes(payload.message.author.id)) return;

            const guild = GuildStore.getGuild(payload.guildId);
            const channel = ChannelStore.getChannel(payload.channelId);

            const userDisplayName = RelationshipStore.getNickname(payload.message.author.id) ?? UserStore.getUser(payload.message.author.id).globalName!;
            const locationName = (() => {
                if (guild?.name !== undefined)
                    return `${guild.name}#${channel.name}`;
                if (channel.name === "")
                    return "their dms";
                return channel.name;
            })();
            const targetLink = `/channels/${guild?.id ?? "@me"}/${channel.id}/${payload.message.id}`;

            Notifications.showNotification({
                title: `${userDisplayName} sent a message`,
                body: `click to jump to ${locationName}`,
                onClick() { NavigationRouter.transitionTo(targetLink); },
            });
        },
    },
});
