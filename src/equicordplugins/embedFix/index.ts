/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addMessagePreEditListener, addMessagePreSendListener, MessageSendListener, removeMessagePreEditListener, removeMessagePreSendListener } from "@api/MessageEvents";
import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";

const SETTINGS = definePluginSettings({
    twitterEnabled: {
        type: OptionType.BOOLEAN,
        description: "Enable X (Twitter) embed fixing",
        default: true
    },
    twitterFixer: {
        type: OptionType.SELECT,
        description: "Fixer service for X (Twitter)",
        options: [
            { label: "fxtwitter.com", value: "fxtwitter.com" },
            { label: "fixupx.com", value: "fixupx.com" },
            { label: "twittpr.com", value: "twittpr.com" },
            { label: "xfixup.com", value: "xfixup.com" },
            { label: "vxtwitter.com", value: "vxtwitter.com" },
            { label: "fixvx.com", value: "fixvx.com" }
        ],
        default: "fxtwitter.com"
    },
    instagramEnabled: {
        type: OptionType.BOOLEAN,
        description: "Enable Instagram embed fixing",
        default: true
    },
    instagramFixer: {
        type: OptionType.SELECT,
        description: "Fixer service for Instagram",
        options: [
            { label: "ddinstagram.com", value: "ddinstagram.com" },
            { label: "instagramez.com", value: "instagramez.com" }
        ],
        default: "ddinstagram.com"
    },
    tiktokEnabled: {
        type: OptionType.BOOLEAN,
        description: "Enable TikTok embed fixing",
        default: true
    },
    tiktokFixer: {
        type: OptionType.SELECT,
        description: "Fixer service for TikTok",
        options: [
            { label: "tnktok.com", value: "tnktok.com" },
            { label: "vxtiktok.com", value: "vxtiktok.com" },
            { label: "kktiktok.com", value: "kktiktok.com" },
            { label: "tfxktok.com", value: "tfxktok.com" },
            { label: "tiktxk.com", value: "tiktxk.com" },
            { label: "tiktokez.com", value: "tiktokez.com" }
        ],
        default: "tnktok.com"
    },
    redditEnabled: {
        type: OptionType.BOOLEAN,
        description: "Enable Reddit embed fixing",
        default: true
    },
    redditFixer: {
        type: OptionType.SELECT,
        description: "Fixer service for Reddit",
        options: [
            { label: "rxddit.com", value: "rxddit.com" },
            { label: "rxyddit.com", value: "rxyddit.com" },
            { label: "redditez.com", value: "redditez.com" },
            { label: "vxreddit.com", value: "vxreddit.com" }
        ],
        default: "rxddit.com"
    },
    blueskyEnabled: {
        type: OptionType.BOOLEAN,
        description: "Enable Bluesky embed fixing",
        default: true
    },
    blueskyFixer: {
        type: OptionType.SELECT,
        description: "Fixer service for Bluesky",
        options: [
            { label: "fxbsky.app", value: "fxbsky.app" },
            { label: "vxbsky.app", value: "vxbsky.app" },
            { label: "bskx.app", value: "bskx.app" },
            { label: "bsyy.app", value: "bsyy.app" },
            { label: "bskye.app", value: "bskye.app" },
            { label: "boobsky.app", value: "boobsky.app" }
        ],
        default: "fxbsky.app"
    }
});

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceEmbedUrls(content: string): string {
    const replacements: Array<{ pattern: RegExp, domain: string, fixer: string }> = [];

    if (SETTINGS.store.twitterEnabled) {
        const fixer = SETTINGS.store.twitterFixer || "fxtwitter.com";
        replacements.push({
            pattern: new RegExp("(https?:\\/\\/)?(www\\.)?(twitter\\.com|x\\.com)(\\/[^\\s<>\"']*)?", "gi"),
            domain: "twitter.com",
            fixer: fixer
        });
    }

    if (SETTINGS.store.instagramEnabled) {
        const fixer = SETTINGS.store.instagramFixer || "ddinstagram.com";
        replacements.push({
            pattern: new RegExp("(https?:\\/\\/)?(www\\.)?instagram\\.com(\\/[^\\s<>\"']*)?", "gi"),
            domain: "instagram.com",
            fixer: fixer
        });
    }

    if (SETTINGS.store.tiktokEnabled) {
        const fixer = SETTINGS.store.tiktokFixer || "tnktok.com";
        replacements.push({
            pattern: new RegExp("(https?:\\/\\/)?(www\\.)?tiktok\\.com(\\/[^\\s<>\"']*)?", "gi"),
            domain: "tiktok.com",
            fixer: fixer
        });
    }

    if (SETTINGS.store.redditEnabled) {
        const fixer = SETTINGS.store.redditFixer || "rxddit.com";
        replacements.push({
            pattern: new RegExp("(https?:\\/\\/)?(www\\.)?reddit\\.com(\\/[^\\s<>\"']*)?", "gi"),
            domain: "reddit.com",
            fixer: fixer
        });
    }

    if (SETTINGS.store.blueskyEnabled) {
        const fixer = SETTINGS.store.blueskyFixer || "fxbsky.app";
        replacements.push({
            pattern: new RegExp("(https?:\\/\\/)?(www\\.)?bsky\\.app(\\/[^\\s<>\"']*)?", "gi"),
            domain: "bsky.app",
            fixer: fixer
        });
    }

    for (const { pattern, domain, fixer } of replacements) {
        content = content.replace(pattern, (match, protocol, www, matchedDomain, path) => {
            const cleanPath = path || "";
            const originalUrl = `${matchedDomain || domain}${cleanPath}`;
            const fixerUrl = `https://${fixer}${cleanPath}`;
            return `[${originalUrl}](${fixerUrl})`;
        });
    }

    return content;
}

const messageHandler: MessageSendListener = (_, msg) => {
    if (msg.content && /https?:\/\//.test(msg.content)) {
        msg.content = replaceEmbedUrls(msg.content);
    }
};

const editHandler = (_cid: string, _mid: string, msg: { content?: string; }) => {
    if (msg.content && /https?:\/\//.test(msg.content)) {
        msg.content = replaceEmbedUrls(msg.content);
    }
};

export default definePlugin({
    name: "EmbedFix",
    description: "Automatically replace social media URLs with embed-friendly alternatives",
    authors: [EquicordDevs.Mishal],
    isModified: false,
    settings: SETTINGS,
    start() {
        addMessagePreSendListener(messageHandler);
        addMessagePreEditListener(editHandler);
    },
    stop() {
        removeMessagePreSendListener(messageHandler);
        removeMessagePreEditListener(editHandler);
    }
});
