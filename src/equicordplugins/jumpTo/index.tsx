/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { Channel, Message, User } from "@vencord/discord-types";
import { ChannelStore, Constants, Menu, NavigationRouter, RestAPI, SelectedChannelStore, SelectedGuildStore, Toasts } from "@webpack/common";

const JumpIconFirst = () => {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            width="20"
            height="20"
        >
            <path d="M4.83 4.83 19.41 4.83 19.41 8.07 4.83 8.07ZM12.12 7.26 19.41 19.41 4.83 19.41Z" />
        </svg>
    );
};

const JumpIconLast = () => {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            width="20"
            height="20"
        >
            <path d="M19.17 19.17 4.59 19.17 4.59 15.93 19.17 15.93ZM11.88 16.74 4.59 4.59 19.17 4.59Z" />
        </svg>
    );
};


function jumpToFirstMessage(channelId: string, guildId?: string | null) {
    NavigationRouter.transitionTo(`/channels/${guildId ?? "@me"}/${channelId}/0`);
}

async function jumpToLastMessage(channelId: string, guildId?: string | null) {
    const res = await RestAPI.get({
        url: Constants.Endpoints.MESSAGES(channelId),
        query: { limit: 1 }
    });
    const messageId = res.body?.[0]?.id;
    if (!messageId) return;
    NavigationRouter.transitionTo(`/channels/${guildId ?? "@me"}/${channelId}/${messageId}`);
}

async function jumpToUserMessage(channelId: string, guildId: string, userId: string, first: boolean) {
    try {
        const res = await RestAPI.get({
            url: Constants.Endpoints.SEARCH_GUILD(guildId),
            query: {
                author_id: userId,
                channel_id: channelId,
                sort_by: "timestamp",
                sort_order: first ? "asc" : "desc"
            }
        });

        const messageId = res.body?.messages?.[0]?.[0]?.id;
        if (!messageId) {
            Toasts.show({
                type: Toasts.Type.FAILURE,
                message: "No messages found from this user in this channel.",
                id: Toasts.genId()
            });
            return;
        }

        NavigationRouter.transitionTo(`/channels/${guildId}/${channelId}/${messageId}`);
    } catch (e) {
        Toasts.show({
            type: Toasts.Type.FAILURE,
            message: "Failed to search for messages.",
            id: Toasts.genId()
        });
    }
}

const ChannelMenuPatch: NavContextMenuPatchCallback = (
    children,
    { channel, thread }: { channel?: Channel; thread?: Channel; }
) => {
    const selectedId = SelectedChannelStore.getChannelId();
    const selectedChannel = selectedId ? ChannelStore.getChannel(selectedId) : null;
    const forumChild = channel?.isForumLikeChannel?.() && selectedChannel?.isThread?.() && selectedChannel.parent_id === channel.id
        ? selectedChannel
        : null;
    const targetChannel = thread ?? forumChild ?? channel;
    if (!targetChannel) return;

    children.push(
        <Menu.MenuItem
            id="vc-jump-to-first"
            label="Jump To First Message"
            action={() => jumpToFirstMessage(targetChannel.id, targetChannel.guild_id)}
            icon={JumpIconFirst}
        />,
        <Menu.MenuItem
            id="vc-jump-to-last"
            label="Jump To Last Message"
            action={() => jumpToLastMessage(targetChannel.id, targetChannel.guild_id)}
            icon={JumpIconLast}
        />
    );
};

const UserMenuPatch: NavContextMenuPatchCallback = (children, { user, channel }: { user: User; channel?: Channel; }) => {
    if (!user) return;
    if (!channel || channel.guild_id) return;
    children.push(
        <Menu.MenuItem
            id="vc-jump-to-first"
            label="Jump To First Message"
            action={() => jumpToFirstMessage(channel.id, null)}
            icon={JumpIconFirst}
        />,
        <Menu.MenuItem
            id="vc-jump-to-last"
            label="Jump To Last Message"
            action={() => jumpToLastMessage(channel.id, null)}
            icon={JumpIconLast}
        />
    );
};

const MessageMenuPatch: NavContextMenuPatchCallback = (children, { message }: { message: Message; }) => {
    if (!message) return;
    const channelId = SelectedChannelStore.getChannelId();
    const guildId = SelectedGuildStore.getGuildId();
    if (!channelId || !guildId) return;
    children.push(
        <Menu.MenuItem
            id="vc-jump-to-first-user"
            label="Jump To First Message"
            action={() => jumpToUserMessage(channelId, guildId, message.author.id, true)}
            icon={JumpIconFirst}
        />,
        <Menu.MenuItem
            id="vc-jump-to-last-user"
            label="Jump To Last Message"
            action={() => jumpToUserMessage(channelId, guildId, message.author.id, false)}
            icon={JumpIconLast}
        />
    );
};

export default definePlugin({
    name: "JumpTo",
    description: "Adds context menu options to jump to the start or bottom of a channel/DM.",
    tags: ["Chat", "Utility"],
    authors: [Devs.Samwich, Devs.thororen],
    contextMenus: {
        "channel-context": ChannelMenuPatch,
        "gdm-context": ChannelMenuPatch,
        "thread-context": ChannelMenuPatch,
        "user-context": UserMenuPatch,
        "message": MessageMenuPatch
    }
});
