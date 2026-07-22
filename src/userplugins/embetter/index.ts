/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { MessageObject } from "@api/MessageEvents";
import { definePluginSettings } from "@api/Settings";
import { escapeRegExp } from "@utils/text";
import definePlugin, { OptionType, SettingsDefinition } from "@utils/types";

interface Fixer {
    label: string;
    hosts: Record<string, string>;
    prependsHost?: boolean;
}

interface Platform {
    key: string;
    name: string;
    fixers: Fixer[];
    matchSubdomains?: boolean;
    enabledByDefault?: boolean;
}

const PLATFORMS: Platform[] = [
    {
        key: "twitter",
        name: "Twitter / X",
        fixers: [
            { label: "FxTwitter (fxtwitter.com, fixupx.com)", hosts: { "twitter.com": "fxtwitter.com", "x.com": "fixupx.com" } },
            { label: "BetterTwitFix (vxtwitter.com, fixvx.com)", hosts: { "twitter.com": "vxtwitter.com", "x.com": "fixvx.com" } }
        ]
    },
    {
        key: "bluesky",
        name: "Bluesky",
        fixers: [
            { label: "FxBluesky (fxbsky.app)", hosts: { "bsky.app": "fxbsky.app" } },
            { label: "VixBluesky (bskx.app)", hosts: { "bsky.app": "bskx.app" } },
            { label: "bskye (bskye.app)", hosts: { "bsky.app": "bskye.app" } },
            { label: "vxBsky (vxbsky.app)", hosts: { "bsky.app": "vxbsky.app" } }
        ]
    },
    {
        key: "tiktok",
        name: "TikTok",
        fixers: [
            { label: "fxTikTok (tnktok.com)", hosts: { "tiktok.com": "tnktok.com", "vm.tiktok.com": "tnktok.com", "vt.tiktok.com": "tnktok.com" } },
            { label: "vxTikTok (vxtiktok.com)", hosts: { "tiktok.com": "vxtiktok.com", "vm.tiktok.com": "vxtiktok.com", "vt.tiktok.com": "vxtiktok.com" } },
            { label: "tiktxk (tiktxk.com)", hosts: { "tiktok.com": "tiktxk.com", "vm.tiktok.com": "tiktxk.com", "vt.tiktok.com": "tiktxk.com" } }
        ]
    },
    {
        key: "instagram",
        name: "Instagram",
        fixers: [
            { label: "KKInstagram (kkinstagram.com)", hosts: { "instagram.com": "kkinstagram.com" } },
            { label: "vxInstagram (vxinstagram.com)", hosts: { "instagram.com": "vxinstagram.com" } },
            { label: "EEInstagram (eeinstagram.com)", hosts: { "instagram.com": "eeinstagram.com" } }
        ]
    },
    {
        key: "reddit",
        name: "Reddit",
        fixers: [
            { label: "FixReddit (rxddit.com)", hosts: { "reddit.com": "rxddit.com", "old.reddit.com": "rxddit.com" } },
            { label: "rxyddit (rxyddit.com)", hosts: { "reddit.com": "rxyddit.com", "old.reddit.com": "rxyddit.com" } },
            { label: "vxReddit (vxreddit.com)", hosts: { "reddit.com": "vxreddit.com", "old.reddit.com": "vxreddit.com" } }
        ]
    },
    {
        key: "threads",
        name: "Threads",
        fixers: [
            { label: "FixThreads (fixthreads.seria.moe)", hosts: { "threads.net": "fixthreads.seria.moe", "threads.com": "fixthreads.seria.moe" } }
        ]
    },
    {
        key: "snapchat",
        name: "Snapchat",
        fixers: [
            { label: "EmbedEZ (snapchatez.com)", hosts: { "snapchat.com": "snapchatez.com" } }
        ]
    },
    {
        key: "facebook",
        name: "Facebook",
        fixers: [
            { label: "facebed (facebed.com)", hosts: { "facebook.com": "facebed.com" } },
            { label: "fxFacebook (fxfb.seria.moe)", hosts: { "facebook.com": "fxfb.seria.moe" } }
        ]
    },
    {
        key: "pixiv",
        name: "Pixiv",
        fixers: [
            { label: "phixiv (phixiv.net)", hosts: { "pixiv.net": "phixiv.net" } },
            { label: "ppxiv (ppxiv.net)", hosts: { "pixiv.net": "ppxiv.net" } }
        ]
    },
    {
        key: "twitch",
        name: "Twitch",
        fixers: [
            { label: "fxtwitch (fxtwitch.seria.moe)", hosts: { "twitch.tv": "fxtwitch.seria.moe", "twitch.com": "fxtwitch.seria.moe" } }
        ]
    },
    {
        key: "spotify",
        name: "Spotify",
        fixers: [
            { label: "fxspotify (fxspotify.com)", hosts: { "open.spotify.com": "fxspotify.com", "spotify.com": "fxspotify.com" } }
        ]
    },
    {
        key: "deviantart",
        name: "DeviantArt",
        fixers: [
            { label: "fixDeviantArt (fixdeviantart.com)", hosts: { "deviantart.com": "fixdeviantart.com" } }
        ]
    },
    {
        key: "newgrounds",
        name: "Newgrounds",
        fixers: [
            { label: "FixNewgrounds (fixnewgrounds.com)", hosts: { "newgrounds.com": "fixnewgrounds.com" } }
        ]
    },
    {
        key: "mastodon",
        name: "Mastodon",
        fixers: [
            {
                label: "fxmastodon (fxmas.to)",
                prependsHost: true,
                hosts: Object.fromEntries([
                    "mastodon.social", "mstdn.jp", "mastodon.cloud", "mstdn.social", "mastodon.world",
                    "mastodon.online", "mas.to", "techhub.social", "mastodon.uno", "infosec.exchange"
                ].map(instance => [instance, "fxmas.to"]))
            }
        ]
    },
    {
        key: "tumblr",
        name: "Tumblr",
        matchSubdomains: true,
        fixers: [
            { label: "fxtumblr (tpmblr.com)", hosts: { "tumblr.com": "tpmblr.com" } }
        ]
    },
    {
        key: "bilibili",
        name: "Bilibili",
        fixers: [
            { label: "BiliFix (vxbilibili.com, vxb23.tv)", hosts: { "bilibili.com": "vxbilibili.com", "b23.tv": "vxb23.tv" } }
        ]
    },
    {
        key: "pinterest",
        name: "Pinterest",
        fixers: [
            { label: "EmbedEZ (pinterestez.com)", hosts: { "pinterest.com": "pinterestez.com" } }
        ]
    },
    {
        key: "ifunny",
        name: "iFunny",
        fixers: [
            { label: "EmbedEZ (ifunnyez.co)", hosts: { "ifunny.co": "ifunnyez.co" } }
        ]
    },
    {
        key: "imgur",
        name: "Imgur",
        fixers: [
            { label: "EmbedEZ (imgurez.com)", hosts: { "imgur.com": "imgurez.com" } }
        ]
    },
    {
        key: "weibo",
        name: "Weibo",
        fixers: [
            { label: "EmbedEZ (weiboez.com)", hosts: { "weibo.com": "weiboez.com", "weibo.cn": "weiboez.com" } }
        ]
    },
    {
        key: "furaffinity",
        name: "Fur Affinity",
        fixers: [
            { label: "fxraffinity (fxfuraffinity.net)", hosts: { "furaffinity.net": "fxfuraffinity.net" } },
            { label: "xfuraffinity (xfuraffinity.net)", hosts: { "furaffinity.net": "xfuraffinity.net" } }
        ]
    },
    {
        key: "youtube",
        name: "YouTube",
        enabledByDefault: false,
        fixers: [
            { label: "Koutube (koutube.com)", hosts: { "youtube.com": "koutube.com", "youtu.be": "koutube.com" } }
        ]
    }
];

const platformByHost = new Map<string, Platform>();
for (const platform of PLATFORMS) {
    for (const host of Object.keys(platform.fixers[0].hosts)) {
        platformByHost.set(host, platform);
    }
}

const fixerValue = (fixer: Fixer) => Object.values(fixer.hosts)[0];

function makeSettings() {
    const def: SettingsDefinition = {
        bypassKeyword: {
            type: OptionType.STRING,
            description: "Messages containing this word are sent unchanged, with the word itself removed. Leave empty to disable.",
            default: "fxignore"
        }
    };
    for (const platform of PLATFORMS) {
        def[platform.key] = {
            type: OptionType.BOOLEAN,
            displayName: platform.name,
            description: `Rewrite ${platform.name} links.`,
            default: platform.enabledByDefault ?? true
        };
        if (platform.fixers.length > 1) {
            def[platform.key + "Fixer"] = {
                type: OptionType.SELECT,
                displayName: `${platform.name} fixer`,
                description: `Fixer service used for ${platform.name} links.`,
                options: platform.fixers.map((fixer, i) => ({ label: fixer.label, value: fixerValue(fixer), default: i === 0 }))
            };
        }
    }
    return def;
}

const settings = definePluginSettings(makeSettings());

function activeFixer(platform: Platform) {
    const chosen = settings.store[platform.key + "Fixer"];
    return platform.fixers.find(fixer => fixerValue(fixer) === chosen) ?? platform.fixers[0];
}

function fixUrl(link: string) {
    try {
        const url = new URL(link);
        let host = url.hostname.replace(/^www\./, "");
        let subdomain = "";
        let platform = platformByHost.get(host);
        if (!platform) {
            const root = host.slice(host.indexOf(".") + 1);
            const rootPlatform = platformByHost.get(root);
            if (!rootPlatform?.matchSubdomains) return link;
            platform = rootPlatform;
            subdomain = host.slice(0, host.length - root.length);
            host = root;
        }
        if (!settings.store[platform.key]) return link;

        const fixer = activeFixer(platform);
        url.hostname = subdomain + fixer.hosts[host];
        if (fixer.prependsHost) url.pathname = "/" + host + url.pathname;
        return url.toString();
    } catch {
        return link;
    }
}

const urlOrCode = /```[\s\S]*?```|``[\s\S]*?``|`[^`]*`|<https?:\/\/[^\s>]+>|(https?:\/\/[^\s<>]+[^\s<>.,:;"')|\]])/g;

function fixMessage(msg: MessageObject) {
    const keyword = settings.store.bypassKeyword.trim();
    if (keyword) {
        const bypass = new RegExp(`(?<=^|\\s)${escapeRegExp(keyword)}(?:\\s+|$)`, "gi");
        if (bypass.test(msg.content)) {
            msg.content = msg.content.replace(bypass, "").trim();
            return;
        }
    }
    if (!msg.content.includes("http")) return;
    msg.content = msg.content.replace(urlOrCode, (match, url) => url ? fixUrl(url) : match);
}

export default definePlugin({
    name: "Embetter",
    description: "Rewrites social media links to embed fixing services like FxTwitter before your message is sent, so they embed properly.",
    authors: [{ name: "lostf1sh", id: 470904884946796544n }],
    tags: ["Chat", "Utility"],
    dependencies: ["MessageEventsAPI"],
    settings,

    onBeforeMessageSend: (_, msg) => fixMessage(msg),
    onBeforeMessageEdit: (_cid, _mid, msg) => fixMessage(msg)
});
