/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findGroupChildrenByChildId } from "@api/ContextMenu";
import { Logger } from "@utils/Logger";
import { sleep } from "@utils/misc";
import definePlugin from "@utils/types";
import { Menu, RestAPI, UserStore } from "@webpack/common";
import { settings } from './settings';

const logger = new Logger("SilentDelete");

const createMenuItem = (message) => (
    <Menu.MenuItem
        id="vc-silent-delete"
        label="‌ ‌🗑️‌ ‌ ‌ ‌Silent Delete" // i will NOT edit this "remove spaces and unicode" why? cuz if i remove them the UI will be bad so take it like that >:(
        action={async () => {
            try {
                const response = await RestAPI.post({
                    url: `/channels/${message.channel_id}/messages`,
                    body: {
                        content: settings.store.replacementText,
                        flags: settings.store.suppressNotifications ? 4096 : 0,
                        mobile_network_type: "unknown",
                        nonce: message.id,
                        tts: false,
                    },
                });

                await sleep(settings.store.deleteDelay);
                await RestAPI.del({ url: `/channels/${message.channel_id}/messages/${response.body.id}` });
                await sleep(100);
                await RestAPI.del({ url: `/channels/${message.channel_id}/messages/${message.id}` });
            } catch (err) {
                logger.error("Error:", err);
            }
        }}
    />
);

const messageCtxPatch = (children, { message }) => {
    if (message.author.id !== UserStore.getCurrentUser()?.id) return;

    const group = findGroupChildrenByChildId("delete", children);
    if (!group) return;

    const deleteIndex = group.findIndex(c => c?.props?.id === "delete");
    if (deleteIndex === -1) return;

    group.splice(deleteIndex + 1, 0, createMenuItem(message));
};

const messageActionsPatch = (children, { message }) => {
    if (message.author.id !== UserStore.getCurrentUser()?.id) return;

    const group = findGroupChildrenByChildId("delete", children);
    if (!group) return;

    const deleteIndex = group.findIndex(c => c?.props?.id === "delete");
    if (deleteIndex === -1) return;

    group.splice(deleteIndex + 1, 0, createMenuItem(message));
};

const plugin = definePlugin({
    name: "SilentDelete",
    description: "Silently deletes a message to bypass vencord message loggers.",
    authors: [
        { name: "Duck", id: "798441657895878696" },
        { name: "coder", id: "1099039269391171765" }
    ],
    settings,
    contextMenus: {
        "message": messageCtxPatch,
        "message-actions": messageActionsPatch
    }
});

export default plugin;
