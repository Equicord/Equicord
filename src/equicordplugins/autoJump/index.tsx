/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { ChannelStore, Menu, MessageActions, NavigationRouter } from "@webpack/common";

interface ChannelSelectEvent {
    type: "CHANNEL_SELECT";
    channelId: string | null;
    guildId: string | null;
}

let lastChannelId = "0";

function autoJump({ guild_id, id: channelId }) {
    const guildId = guild_id ?? "@me";

    lastChannelId = channelId;
    NavigationRouter.transitionTo(`/channels/${guildId}/${channelId}`);
    MessageActions.jumpToPresent(channelId, { limit: null });
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
            if (!channelId) return;

            const channel = ChannelStore.getChannel(channelId);
            if (!channel || channel.id === lastChannelId) return;

            autoJump({ guild_id: guildId, id: channelId });
        }
    }
});
