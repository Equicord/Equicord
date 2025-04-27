/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { Menu, ChannelStore, MessageActions, NavigationRouter } from "@webpack/common";

interface ChannelSelectEvent {
    type: "CHANNEL_SELECT";
    channelId: string | null;
    guildId: string | null;
}

let lastChan = "1155026301791514655"

function autoJump(props) {
    const guildid = props.guild_id !== null ? props.guild_id : "@me";
    const channelid = props.id;
    if (channelid == lastChan) return;
    if (channelid !== lastChan) NavigationRouter.transitionTo(`/channels/${guildid}/${channelid}`);
    lastChan = channelid
    MessageActions.jumpToPresent(channelid,{"limit":null})
}

const MenuPatch: NavContextMenuPatchCallback = (children, { channel }) => {
    children.push(
        <Menu.MenuItem
            id="auto-jump"
            label="Jump to Last Message"
            action={() => {
                autoJump(channel);
            }}
        />
    );
};

export default definePlugin({
    name: "autoJump",
    description: "Jumps to Last Message in Channel when switching channel(s) & adds an option in context-menu.",
    authors: [EquicordDevs.omaw],
    contextMenus:
    {
        "channel-context": MenuPatch,
        "user-context": MenuPatch,
        "thread-context": MenuPatch
    },
    flux: { 
       async CHANNEL_SELECT({ guildId, channelId }: ChannelSelectEvent) {
            if (guildId && channelId) {
                const channel = ChannelStore.getChannel(channelId);
                if (!channel) return;
                if (channel.id == lastChan) return;
                autoJump(channel);
            }
       }
    }
});