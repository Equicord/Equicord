/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { ChannelStore, MessageActions, MessageStore, UserStore } from "@webpack/common";
import { Channel, Message } from "discord-types/general";

function shouldEdit(channel: Channel, message: Message) {
    let should = true;

    if (channel.isGroupDM()) {
        if (channel.name === message.content) {
            should = false;
        }
    }

    if (message.author.id === UserStore.getCurrentUser().id) {
        should = false;
    }

    return {
        should: should,
        content: message.content
    };
}

export default definePlugin({
    name: "MessageMerger",
    description: "Merges new messages into the previous message if no one else has sent a message after you.",
    authors: [EquicordDevs.port22exposed],
    dependencies: [],
    onBeforeMessageSend(channelId, message) {
        const messages = MessageStore.getMessages(channelId)._map;

        if (!messages) {
            return;
        }

        const entries = Object.entries(messages);
        const [lastMessageId, lastMessage] = entries[entries.length - 1];

        const channel = ChannelStore.getChannel(channelId);

        const { should, content } = shouldEdit(channel, lastMessage as Message);

        if (should) {
            MessageActions.editMessage(channelId, lastMessageId, {
                content: `${content}\n${message.content}`
            });
            message.content = "";
        }
    },
});
