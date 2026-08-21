/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import type { Channel } from "@vencord/discord-types";
import { Menu, openModal, PermissionsBits,PermissionStore } from "@webpack/common";

import { BulkMoveModal } from "./BulkMoveModal";

function isVoiceChannel(channel: Channel | undefined): boolean {
    return channel != null && (channel.type === 2 || channel.type === 13);
}

function openBulkMoveModal(channel: Channel) {
    openModal(modalProps => (
        <BulkMoveModal modalProps={modalProps} channel={channel} />
    ));
}

const channelContextMenu: NavContextMenuPatchCallback = (children, { channel }: { channel: Channel }) => {
    if (!isVoiceChannel(channel)) return;
    if (!PermissionStore.can(PermissionsBits.MOVE_MEMBERS, channel)) return;

    children.splice(-1, 0,
        <Menu.MenuItem
            key="vc-bulk-move-open"
            id="vc-bulk-move-open"
            label="Bulk move members"
            action={() => openBulkMoveModal(channel)}
        />
    );
};

export default definePlugin({
    name: "VoiceBulkMove",
    description: "Move multiple voice channel members at once through a modal.",
    tags: ["Servers", "Utility", "Voice"],
    authors: [EquicordDevs.whoami],
    contextMenus: {
        "channel-context": channelContextMenu,
    },
});
