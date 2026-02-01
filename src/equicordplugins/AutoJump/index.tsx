/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { Menu, ComponentDispatch } from "@webpack/common";
import { NavContextMenuPatchCallback } from "@api/ContextMenu";

let lastChannelId: string | null = null;
const MenuPatch: NavContextMenuPatchCallback = (children) => {
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
    description: "Automatically jump to the bottom when switching channels.",
    authors: [EquicordDevs.omaw],
    contextMenus: {
        "channel-context": MenuPatch,
        "user-context": MenuPatch,
        "thread-context": MenuPatch
    },
    flux: {
        CHANNEL_SELECT({ channelId, messageId }) {
            if (!channelId || messageId || lastChannelId === channelId) return;
            lastChannelId = channelId;
            ComponentDispatch.dispatch("SCROLLTO_PRESENT");
        }
    }
});
