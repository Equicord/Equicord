/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addMessagePreSendListener, removeMessagePreSendListener } from "@api/MessageEvents";
import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";

const handleMessage = (channelId: string, message: { content: string }) => {
    const words = message.content.trim().split(/\s+/);
    if (words.length === 0) return;

    let index = -1;
    do {
        index = Math.floor(Math.random() * words.length);
    } while (words[index].startsWith("<@") && words.length > 1);

    const word = words[index];
    if (!word.startsWith("<@")) {
        words[index] = word === word.toUpperCase() ? word + "INGTON" : word + "ington";
    }
    message.content = words.join(" ");
};

export default definePlugin({
    name: "Plugington",
    description: "Suffixes 'ington' to a random word in your message",
    authors: [EquicordDevs.zyqunix],
    start() {
        addMessagePreSendListener(handleMessage);
    },
    stop() {
        removeMessagePreSendListener(handleMessage);
    }
});
