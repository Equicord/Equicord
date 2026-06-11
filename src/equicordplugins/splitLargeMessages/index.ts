/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { MessageSendListener } from "@api/MessageEvents";
import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import { getCurrentChannel, sendMessage } from "@utils/discord";
import definePlugin, { OptionType } from "@utils/types";
import { ChannelStore, ComponentDispatch, PermissionsBits, UserStore } from "@webpack/common";

let maxLength: number = 0;

const canSplit: () => boolean = () => {
    const slowmode = getCurrentChannel()?.rateLimitPerUser ?? 0;
    return (settings.store.splitInSlowmode ? slowmode < settings.store.slowmodeMax : slowmode <= 0) && settings.store.disableFileConversion;
};

const autoMaxLength = () => {
    const hasNitro = UserStore.getCurrentUser()?.premiumType === 2;
    return hasNitro ? 4000 : 2000;
};

const split = async (channelId: string, chunks: string[], delayInMs: number) => {
    const sendChunk = async (chunk: string) => {
        await sendMessage(channelId, { content: chunk }, true);
    };

    // Send the chunks
    for (let i = 0; i < chunks.length; i++) {
        await sendChunk(chunks[i]);
        if (i < chunks.length - 1) // Not the last chunk
            await new Promise(resolve => setTimeout(resolve, delayInMs)); // Wait for `delayInMs`
    }
};

const listener: MessageSendListener = async (channelId, msg) => {
    if (msg.content.trim().length < maxLength || !canSplit()) return; // Nothing to split

    const channel = ChannelStore.getChannel(channelId);

    // Check for slowmode
    let isSlowmode = channel.rateLimitPerUser > 0;
    if ((channel.accessPermissions & PermissionsBits.MANAGE_MESSAGES) === PermissionsBits.MANAGE_MESSAGES
        || (channel.accessPermissions & PermissionsBits.MANAGE_CHANNELS) === PermissionsBits.MANAGE_CHANNELS)
        isSlowmode = false;

    // Not slowmode or splitInSlowmode is on and less than slowmodeMax
    if (!isSlowmode || (settings.store.splitInSlowmode && channel.rateLimitPerUser < settings.store.slowmodeMax)) {
        const { hardSplit, respectCodeBlocks } = settings.store;
        let finalChunks: string[] = [];

        if (respectCodeBlocks) {
            // New Behavior: Parse and preserve triple backticks
            const segments: string[] = [];
            const parts = msg.content.split("```");

            const splitNormalText = (text: string, maxLen: number, hard: boolean): string[] => {
                if (!text) return [];
                const res: string[] = [];
                let remaining = text;
                while (remaining.length > maxLen) {
                    let splitIndex = Math.max(remaining.lastIndexOf(" ", maxLen), remaining.lastIndexOf("\n", maxLen));
                    if (hard || splitIndex === -1) splitIndex = maxLen;
                    res.push(remaining.slice(0, splitIndex));
                    remaining = remaining.slice(splitIndex);
                }
                if (remaining.length > 0) res.push(remaining);
                return res;
            };

            const splitCodeBlock = (innerContent: string, maxLen: number, hard: boolean): string[] => {
                const match = innerContent.match(/^([a-zA-Z0-9+#-]+)?\n/);
                const langTag = match ? match[0] : "";
                const actualCode = innerContent.slice(langTag.length);

                const startWrap = `\`\`\`${langTag}`;
                const endWrap = `\n\`\`\``;
                const innerMax = maxLen - startWrap.length - endWrap.length;

                if (innerMax <= 0) return [`\`\`\`${innerContent}\`\`\``];

                const codeChunks: string[] = [];
                let remaining = actualCode;

                while (remaining.length > innerMax) {
                    let splitIndex = Math.max(remaining.lastIndexOf("\n", innerMax), remaining.lastIndexOf(" ", innerMax));
                    if (hard || splitIndex === -1) splitIndex = innerMax;
                    codeChunks.push(remaining.slice(0, splitIndex));
                    remaining = remaining.slice(splitIndex);
                }
                if (remaining.length > 0 || codeChunks.length === 0) codeChunks.push(remaining);

                return codeChunks.map(chunk => `${startWrap}${chunk}${endWrap}`);
            };

            for (let i = 0; i < parts.length; i++) {
                const isCode = i % 2 === 1;
                const part = parts[i];
                if (!part && i !== parts.length - 1) continue;

                if (!isCode) {
                    segments.push(...splitNormalText(part, maxLength, hardSplit));
                } else {
                    segments.push(...splitCodeBlock(part, maxLength, hardSplit));
                }
            }

            let currentChunk = "";
            for (const seg of segments) {
                if ((currentChunk + seg).length > maxLength) {
                    if (currentChunk) finalChunks.push(currentChunk);
                    currentChunk = seg;
                } else {
                    currentChunk += seg;
                }
            }
            if (currentChunk) finalChunks.push(currentChunk);

        } else {
            // Original Behavior: Blind splitting
            let content = msg.content;
            while (content.length > maxLength) {
                content = content.trim();
                const splitIndex = Math.max(content.lastIndexOf(" ", maxLength), content.lastIndexOf("\n", maxLength));

                if (hardSplit || splitIndex === -1) {
                    finalChunks.push(content.slice(0, maxLength));
                    content = content.slice(maxLength);
                } else {
                    finalChunks.push(content.slice(0, splitIndex));
                    content = content.slice(splitIndex);
                }
            }
            if (content.length > 0) finalChunks.push(content);
        }

        ComponentDispatch.dispatchToLastSubscribed("CLEAR_TEXT");
        await split(channelId, finalChunks, settings.store.sendDelay * 1000);
    }
    return { cancel: true };
};

const settings = definePluginSettings({
    maxLength: {
        type: OptionType.NUMBER,
        description: "Maximum length of a message before it is split. Set to 0 to automatically detect.",
        default: 0,
        max: 4000,
        onChange(newValue) {
            if (newValue === 0)
                maxLength = autoMaxLength();
        },
    },
    disableFileConversion: {
        type: OptionType.BOOLEAN,
        description: "If true, disables file conversion for large messages.",
        default: true,
    },
    sendDelay: {
        type: OptionType.SLIDER,
        description: "Delay between each chunk in seconds.",
        default: 1,
        markers: [1, 2, 3, 5, 10],
    },
    hardSplit: {
        type: OptionType.BOOLEAN,
        description: "If true, splits on the last character instead of the last space/newline.",
        default: false,
    },
    respectCodeBlocks: {
        type: OptionType.BOOLEAN,
        description: "If true, intelligently slices triple-backtick code blocks to preserve formatting.",
        default: true,
    },
    splitInSlowmode: {
        type: OptionType.BOOLEAN,
        description: "Should messages be split if the channel has slowmode enabled?",
    },
    slowmodeMax: {
        type: OptionType.NUMBER,
        description: "Maximum slowmode time if splitting in slowmode.",
        default: 5,
        min: 1,
        max: 30,
    }
});

export default definePlugin({
    name: "SplitLargeMessages",
    description: "Splits large messages into multiple to fit Discord's message limit.",
    dependencies: ["MessageEventsAPI"],
    tags: ["Appearance", "Customisation", "Chat"],
    authors: [EquicordDevs.Reycko],
    settings,
    onBeforeMessageSend: listener,

    start() {
        if (settings.store.maxLength === 0) maxLength = autoMaxLength();
    },

    patches: [
        {
            find: 'type:"MESSAGE_LENGTH_UPSELL"', // bypass message length check
            replacement: {
                match: /if\(\i.length>\i/,
                replace: "if(false",
            }
        },

        {
            find: ".onHideAutocomplete?", // disable file conversion
            replacement: {
                match: /(?<=getData\(\i\.type\);)if\(\i.length>\i\)/,
                replace: "if(false)",
            },
        }
    ]
});
