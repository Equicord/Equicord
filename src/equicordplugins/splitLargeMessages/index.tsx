/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { MessageSendListener } from "@api/MessageEvents";
import { isPluginEnabled } from "@api/PluginManager";
import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import characterCounter from "@plugins/characterCounter";
import { EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { getCurrentChannel, sendMessage } from "@utils/discord";
import { classes, sleep } from "@utils/misc";
import definePlugin, { OptionType } from "@utils/types";
import { Channel, User } from "@vencord/discord-types";
import { findByPropsLazy } from "@webpack";
import { ChannelStore, ComponentDispatch, PermissionsBits, PermissionStore, Toasts, UserStore } from "@webpack/common";

const cl = classNameFactory("vc-splitLargeMessages-");

const settings = definePluginSettings({
    maxLength: {
        type: OptionType.NUMBER,
        description: "Maximum length of a message before it is split. Set to 0 to automatically detect.",
        default: 0,
    },
    sendDelay: {
        type: OptionType.SLIDER,
        description: "Delay between each chunk in seconds.",
        default: 1,
        markers: [0.5, 1, 2, 3, 4, 5],
    },
    splitMode: {
        type: OptionType.SELECT,
        description: "How the message should be split",
        default: "spaces",
        options: [
            { value: "hard", label: "Strict Character Limit" },
            { value: "spaces", label: "Spaces" },
            { value: "newlines", label: "Newlines" }
        ]
    },
    leaveGaps: {
        type: OptionType.BOOLEAN,
        description: "Preserve empty lines when splitting on newlines.",
        default: true,
    },
    splitInSlowmode: {
        type: OptionType.BOOLEAN,
        description: "Should messages be split if the channel has slowmode enabled?",
        default: false,
    },
    slowmodeMax: {
        type: OptionType.SELECT,
        description: "Maximum slowmode time if splitting in slowmode.",
        default: 5,
        options: [
            { label: "5 seconds", value: 5 },
            { label: "10 seconds", value: 10 },
            { label: "15 seconds", value: 15 },
            { label: "30 seconds", value: 30 }
        ]
    }
});

const DEFAULT_LIMITS = { standard: 2000, premium: 4000 };
const SAFE_MARGIN = 10;
const SPLIT_LIMIT_FRACTION = 0.975;
const CODE_BLOCK_REGEX = /`{3,}\S*\n|`{3,}/g;
const CODE_LINE_REGEX = /[^`]?`{1,2}[^`]|[^`]`{1,2}[^`]?/g;

const NitroUtils = findByPropsLazy("canUseIncreasedMessageLength") as {
    canUseIncreasedMessageLength?: (user: User) => boolean;
};

function getMaxAllowedLimit() {
    const user = UserStore.getCurrentUser();
    const canUseIncreased = NitroUtils?.canUseIncreasedMessageLength?.(user) ?? false;
    return canUseIncreased ? DEFAULT_LIMITS.premium : DEFAULT_LIMITS.standard;
}

function getActiveLimit() {
    const maxAllowed = getMaxAllowedLimit();
    return settings.store.maxLength > 0
        ? Math.min(settings.store.maxLength, maxAllowed)
        : maxAllowed;
}

function getSplitLimit() {
    return Math.max(1, getActiveLimit() - SAFE_MARGIN);
}

function canSplitInChannel(channel?: Channel | null) {
    if (!channel) return false;

    const slowmode = channel.rateLimitPerUser ?? 0;
    if (slowmode <= 0) return true;

    if (
        PermissionStore.can(PermissionsBits.MANAGE_MESSAGES, channel) ||
        PermissionStore.can(PermissionsBits.MANAGE_CHANNELS, channel)
    ) {
        return true;
    }

    return settings.store.splitInSlowmode && slowmode <= (settings.store.slowmodeMax ?? 5);
}

function getEffectiveSendDelay(channel?: Channel | null) {
    const baseDelay = settings.store.sendDelay * 1000;
    if (!channel) return baseDelay;

    const slowmode = (channel.rateLimitPerUser ?? 0) * 1000;
    const bypassSlowmode =
        PermissionStore.can(PermissionsBits.MANAGE_MESSAGES, channel) ||
        PermissionStore.can(PermissionsBits.MANAGE_CHANNELS, channel);

    if (bypassSlowmode) return baseDelay;
    return Math.max(baseDelay, slowmode + 250);
}

const splitAndSend = async (channelId: string, chunks: string[], delayInMs: number) => {
    const total = chunks.length;
    for (let i = 0; i < total; i++) {
        await sendMessage(channelId, { content: chunks[i] }, true);

        if (i < total - 1 && delayInMs > 0) {
            await sleep(delayInMs);
        }
    }
    Toasts.show({
        message: `${total}/${total} message parts sent.`,
        id: "vc-splitLargeMessages-success",
        type: Toasts.Type.SUCCESS
    });
};

const listener: MessageSendListener = (channelId, msg) => {
    const limit = getSplitLimit();
    const channel = ChannelStore.getChannel(channelId);
    const tooLong = msg.content.length > limit;
    const canSplit = canSplitInChannel(channel);
    const delay = getEffectiveSendDelay(channel);

    if (!tooLong) return;

    if (!canSplit) {
        Toasts.show({
            message: "Can't split message in this channel (slowmode).",
            id: "vc-splitLargeMessages-blocked",
            type: Toasts.Type.FAILURE
        });
        return { cancel: true };
    }

    ComponentDispatch.dispatchToLastSubscribed("CLEAR_TEXT");

    const chunks = splitMessageSafe(msg.content, limit);

    void splitAndSend(channelId, chunks, delay);

    return { cancel: true };
};

function hardSplit(text: string, limit: number): string[] {
    const chunks: string[] = [];
    const chars = Array.from(text);
    for (let i = 0; i < chars.length; i += limit) {
        chunks.push(chars.slice(i, i + limit).join(""));
    }
    return chunks;
}

export default definePlugin({
    name: "SplitLargeMessages",
    description: "Splits large messages into multiple to fit Discord's message limit.",
    dependencies: ["MessageEventsAPI"],
    tags: ["Chat", "Utility"],
    authors: [EquicordDevs.Reycko, EquicordDevs.lucabeyer],

    settings,
    onBeforeMessageSend: listener,

    patches: [
        {
            find: 'type:"MESSAGE_LENGTH_UPSELL"',
            replacement: {
                match: /if\(\i.length>\i/,
                replace: "if(false",
            }
        },
        {
            find: ".onHideAutocomplete?",
            replacement: {
                match: /(?<=getData\(\i\.type\);)if\(\i.length>\i\)/,
                replace: "if(false)",
            },
        },
        {
            find: ".CREATE_FORUM_POST||",
            replacement: {
                match: /(?<=textValue:(\i),editorHeight:\i,channelId:\i\.id\}\)),/,
                replace: ",$self.renderSplitCounter({ text: $1 }),"
            }
        }
    ],

    renderSplitCounter: ErrorBoundary.wrap(({ text }: { text: string; }) => {
        const limit = getSplitLimit();
        const channel = getCurrentChannel();

        if (!text?.length || text.length <= limit || !canSplitInChannel(channel)) return null;

        const count = splitMessageSafe(text, limit).length;
        if (count <= 1) return null;

        const isCharCounterActive = isPluginEnabled(characterCounter.name);

        return (
            <div className={classes(cl("counter"), isCharCounterActive && cl("shifted"))}>
                <span>{count}</span>
                <span> messages</span>
            </div>
        );
    }, { noop: true }),
});

function splitMessageSafe(text: string, limit: number): string[] {
    if (!text) return [];
    if (text.length <= limit) return [text];

    if (settings.store.splitMode === "hard") {
        return hardSplit(text, limit);
    }

    const cleanText = text.replace(/\t/g, "    ");
    const initialChunks = createChunks(cleanText, limit, settings.store.splitMode ?? "spaces");
    const repairedChunks = repairMarkdownAndGaps(initialChunks, settings.store.leaveGaps).filter(Boolean);

    return repairedChunks.length > 0 ? repairedChunks : hardSplit(cleanText, limit);
}

function createChunks(text: string, limit: number, mode: string): string[] {
    if (mode === "hard") return hardSplit(text, limit);

    const separator = mode === "newlines" ? "\n" : " ";
    const fallbackMode = mode === "newlines" ? "spaces" : "hard";

    const parts = text.split(separator);
    const chunks: string[] = [];
    const splitLimit = Math.floor(limit * SPLIT_LIMIT_FRACTION);

    let current = "";

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLast = i === parts.length - 1;
        const token = isLast ? part : part + separator;

        if (token.length > splitLimit) {
            if (current) {
                chunks.push(current);
                current = "";
            }

            const subChunks = createChunks(token, limit, fallbackMode);

            if (subChunks.length > 0) {
                chunks.push(...subChunks.slice(0, -1));
                current = subChunks[subChunks.length - 1];
            }
        } else if ((current + token).length > splitLimit) {
            chunks.push(current);
            current = token;
        } else {
            current += token;
        }
    }

    if (current) chunks.push(current);

    return chunks;
}

function repairMarkdownAndGaps(chunks: string[], leaveGaps: boolean): string[] {
    const repairedChunks: string[] = [];
    let insertCodeBlock = "";
    let insertCodeLine = "";

    for (let i = 0; i < chunks.length; i++) {
        let chunk = chunks[i];

        if (insertCodeBlock) {
            chunk = insertCodeBlock + chunk;
            insertCodeBlock = "";
        } else if (insertCodeLine) {
            chunk = insertCodeLine + chunk;
            insertCodeLine = "";
        }

        const codeBlocks = chunk.match(CODE_BLOCK_REGEX);
        const codeLines = chunk.match(CODE_LINE_REGEX);

        if (codeBlocks && codeBlocks.length % 2 !== 0) {
            chunk += "```";
            insertCodeBlock = codeBlocks[codeBlocks.length - 1] + "\n";
        } else if (codeLines && codeLines.length % 2 !== 0) {
            insertCodeLine = codeLines[codeLines.length - 1].replace(/[^`]/g, "");
            chunk += insertCodeLine;
        }

        if (leaveGaps) {
            if (/^\s*\n/.test(chunk)) {
                chunk = "** **" + chunk;
            }
            if (/\n\s*$/.test(chunk)) {
                chunk += "** **";
            }
        }

        repairedChunks.push(chunk);
    }

    return repairedChunks;
}
