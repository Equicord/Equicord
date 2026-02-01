/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { Menu, ChannelStore, NavigationRouter, MessageActions, MessageStore, ComponentDispatch } from "@webpack/common";

interface ChannelSelectEvent {
    type: "CHANNEL_SELECT";
    channelId: string | null;
    guildId: string | null;
    messageId?: string | null;
}

let lastChannelId = "0";

function autoJump(channel: any) {
    const guildId = channel.guild_id ?? "@me";
    const channelId = channel.id;

    if (channelId === lastChannelId) return;

    lastChannelId = channelId;

    ComponentDispatch.dispatch("SCROLLTO_PRESENT");
}

const MenuPatch: NavContextMenuPatchCallback = (children, { channel }) => {
    children.push(
        <Menu.MenuItem
            id="auto-jump"
            label="Jump to Last Message"
            action={() => ComponentDispatch.dispatch("SCROLLTO_PRESENT")}
        />
    );
};

export default definePlugin({
    name: "AutoJump",
    description: "Automatically jumps to the last message when selecting a channel.",
    authors: [EquicordDevs.omaw],
    
    contextMenus: {
        "channel-context": MenuPatch,
        "user-context": MenuPatch,
        "thread-context": MenuPatch
    },
    
    flux: {
        async CHANNEL_SELECT(event: ChannelSelectEvent) {
            const { guildId, channelId, messageId } = event;
            
            if (!guildId || !channelId) return;
            if (lastChannelId === channelId) return;
            if (messageId) {
                lastChannelId = channelId;
                return;
            }
            
            const channel = ChannelStore.getChannel(channelId);
            if (!channel) return;
            
            autoJump(channel);
        }
    }
});
