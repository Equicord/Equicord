/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { RobotIcon } from "@components/Icons";
import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { Message } from "@vencord/discord-types";
import { ChannelStore, Menu } from "@webpack/common";

import { settings } from "./settings";
import { getPayload, getResponse, handleResponse } from "./utils";

const messageCtxPatch: NavContextMenuPatchCallback = (children, { message }: { message: Message; }) => {
    if (!message.content.trim() && !message.embeds.length && (!settings.store.supportImages || !message.attachments.some(att => att.content_type?.startsWith("image/")))) return;

    const group = findGroupChildrenByChildId("copy-text", children);
    if (!group) return;

    group.splice(group.findIndex(c => c?.props?.id === "copy-text") + 1, 0, (
        <Menu.MenuItem
            id="vc-trivia-ai"
            label="Answer With AI"
            icon={RobotIcon}
            action={async () => {
                const payload = await getPayload(message);
                if (!payload) return;

                const ans = await getResponse(payload);
                handleResponse(message, ans);
            }}
        />
    ));
};

export default definePlugin({
    name: "TriviaAI",
    description: "A plugin that helps you answer trivia questions using AI.",
    dependencies: ["MessagePopoverAPI"],
    tags: ["Appearance", "Customisation", "Fun"],
    authors: [EquicordDevs.yash],
    settings,
    contextMenus: {
        "message": messageCtxPatch
    },
    messagePopoverButton: {
        icon: RobotIcon,
        render(message: Message) {
            if (!message.content.trim() && !message.embeds.length && (!settings.store.supportImages || !message.attachments.some(att => att.content_type?.startsWith("image/")))) return null;

            return {
                label: "Answer With AI",
                icon: RobotIcon,
                message,
                channel: ChannelStore.getChannel(message.channel_id),
                onClick: async () => {
                    const payload = await getPayload(message);
                    if (!payload) return;

                    const ans = await getResponse(payload);
                    handleResponse(message, ans);
                }
            };
        }
    }
});
