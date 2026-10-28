/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { MessageSendListener } from "@api/MessageEvents";
import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { MessageStore, UserStore } from "@webpack/common";

const settings = definePluginSettings({
    timeWindow: {
        type: OptionType.NUMBER,
        description: "Send messages silently when sent within this many seconds of your previous message.",
        default: 180,
        isValid: value => typeof value === "number" && Number.isInteger(value) && value > 0 || "Enter a positive whole number."
    },
    dmsOnly: {
        type: OptionType.BOOLEAN,
        description: "Only send follow-up messages silently in DMs and group DMs.",
        default: true
    }
});

const onBeforeMessageSend: MessageSendListener = (channelId, message, _options, { channel }) => {
    const { timeWindow, dmsOnly } = settings.store;
    if (dmsOnly && !channel.isDM() && !channel.isGroupDM() && !channel.isMultiUserDM()) return;

    const content = message.content.trim();
    if (!content || content.startsWith("@silent ")) return;

    const previous = MessageStore.getLastMessage(channelId);
    if (!previous || previous.author.id !== UserStore.getCurrentUser().id) return;

    if (Date.now() - previous.timestamp.getTime() <= timeWindow * 1000) {
        message.content = `@silent ${message.content}`;
    }
};

export default definePlugin({
    name: "SilentWalls",
    description: "Automatically adds @silent to consecutive messages to avoid notification spam.",
    authors: [EquicordDevs.rot],
    tags: ["Chat", "Notifications"],
    dependencies: ["MessageEventsAPI"],
    settings,
    onBeforeMessageSend
});
