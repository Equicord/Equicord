/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addMessagePreSendListener, removeMessagePreSendListener } from "@api/MessageEvents";
import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";

const isLegal = (word: string, message: { attachments?: any[]; }) => {
    if (word.startsWith("<@")) return false;
    if (/^https?:\/\//i.test(word)) return false;
    if (message.attachments && message.attachments.length > 0) return false;
    return true;
};

const handleMessage = (channelId: string, message: { content: string; attachments?: any[]; }) => {
    const words = message.content.trim().split(/\s+/);
    if (words.length === 0) return;

    let index = -1;
    let attempts = 0;
    do {
        index = Math.floor(Math.random() * words.length);
        attempts++;
    } while (!isLegal(words[index], message) && attempts < words.length * 2);

    if (isLegal(words[index], message)) {
        const word = words[index];
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
