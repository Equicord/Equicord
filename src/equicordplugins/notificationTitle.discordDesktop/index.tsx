/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import { getIntlMessage } from "@utils/discord";
import definePlugin from "@utils/types";
import type { Channel, Message, User } from "@vencord/discord-types";
import { ChannelType, MessageType } from "@vencord/discord-types/enums";
import { findByCodeLazy, findByPropsLazy } from "@webpack";
import { ChannelStore, GuildStore, RelationshipStore, UserStore } from "@webpack/common";

const { getName } = findByPropsLazy("getName", "useName", "getNickname");
const computeChannelName = findByCodeLazy(".isThread())return'\"'.concat(");

const ChannelTypesSets = findByPropsLazy("THREADS", "GUILD_TEXTUAL", "ALL_DMS");

export default definePlugin({
    name: "NotificationTitle",
    description: "Makes desktop notifications more informative",
    authors: [Devs.Kyuuhachi],

    patches: [
        {
            find: '"SystemMessageUtils.stringify(...) could not convert"',
            replacement: {
                match: /{icon:.{0,50}emoji:\i}/,
                replace: "($self.makeTitle($&,...arguments))",
            }
        },
    ],

    makeTitle(result: { title: string; }, channel: Channel, message: Message & { referenced_message?: { author: { id: string; }; }; }, user: User) {
        const username = getName(channel.guild_id, channel.id, user);

        let title = username;
        if (message.type === MessageType.REPLY && message.referenced_message?.author) {
            const replyUser = UserStore.getUser(message.referenced_message.author.id);
            const replyUsername = getName(channel.guild_id, channel.id, replyUser);
            title = getIntlMessage("CHANNEL_MESSAGE_REPLY_A11Y_LABEL", {
                author: username,
                repliedAuthor: replyUsername,
            });
        }

        const guild = GuildStore.getGuild(channel.guild_id);
        const parent = ChannelStore.getChannel(channel.parent_id);

        if (channel.type !== ChannelType.DM) {
            let where = ChannelTypesSets.THREADS.has(channel.type)
                ? `${channelName(channel)} in ${channelName(parent, true)}`
                : `${channelName(channel, true)}`;
            if (guild != null)
                where += `, ${guild.name}`;
            title += `\n(${where})`;
        }
        result.title = title;

        return result;
    }
});

function channelName(channel: Channel, withPrefix = false) {
    return computeChannelName(channel, UserStore, RelationshipStore, withPrefix);
}
