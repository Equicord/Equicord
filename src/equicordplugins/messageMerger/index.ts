/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { MessageActions, MessageStore, UserStore } from "@webpack/common";

function isMessage(obj: unknown): obj is { author: { id: string; }; content: string; } {
    return (
        typeof obj === "object" &&
        obj !== null &&
        "author" in obj &&
        typeof (obj as any).author === "object" &&
        "id" in (obj as any).author &&
        typeof (obj as any).author.id === "string" &&
        "content" in obj &&
        typeof (obj as any).content === "string"
    );
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
        const [lastMessageId, lastMessageContent] = entries[entries.length - 1];
        if (isMessage(lastMessageContent) && lastMessageContent.author.id === UserStore.getCurrentUser().id) {
            MessageActions.editMessage(channelId, lastMessageId, {
                content: `${lastMessageContent.content}\n${message.content}`
            });
            message.content = "";
        }
    },
});
