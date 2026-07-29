/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { Switch } from "@components/Switch";
import { EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import definePlugin from "@utils/types";
import { Embed, Message, MessageAttachment } from "@vencord/discord-types";
import { useState } from "@webpack/common";

const cl = classNameFactory("vc-excludeGifsFromSearch-");

const KNOWN_GIF_DOMAINS = [
    "tenor.com",
    "giphy.com",
    "klipy.com",
    "gfycat.com",
    "redgifs.com",
    "picmix.com"
];

// Discord routes external media through its CDN proxy, e.g.:
//   media.discordapp.net/external/<hash>/https/tenor.com/...
//   images-ext-1.discordapp.net/external/<hash>/https/giphy.com/...
const PROXY_EXTERNAL_REGEX = /\/external\/[^/]+\/https?\/([^/]+)/i;

function extractRealHost(rawUrl: string | undefined | null): string | null {
    if (!rawUrl) return null;

    try {
        const url = new URL(rawUrl);

        const proxyMatch = url.pathname.match(PROXY_EXTERNAL_REGEX);
        if (proxyMatch) return proxyMatch[1].toLowerCase();

        return url.hostname.toLowerCase();
    } catch {
        return null;
    }
}

function hostMatchesKnownGifDomain(host: string | null): boolean {
    if (!host) return false;
    return KNOWN_GIF_DOMAINS.some(domain => host === domain || host.endsWith("." + domain));
}

function isImgurGifv(host: string | null, rawUrl: string | undefined | null): boolean {
    if (!host || !rawUrl) return false;
    if (host !== "imgur.com" && !host.endsWith(".imgur.com")) return false;
    return /\.gifv(?:[?#]|$)/i.test(rawUrl);
}

const TWITTER_GIF_HOST_HINTS = ["twitter.com", "x.com", "fxtwitter.com", "vxtwitter.com", "fixupx.com"];

function isLikelyTwitterAnimatedMedia(host: string | null, rawUrl: string | undefined | null): boolean {
    if (!host || !rawUrl) return false;
    const matches = TWITTER_GIF_HOST_HINTS.some(d => host === d || host.endsWith("." + d));
    if (!matches) return false;
    
    return /tweet_video/i.test(rawUrl) || /\.(webp|gif)(?:[?#]|$)/i.test(rawUrl);
}

function embedIsGif(embed: Embed): boolean {
    if (embed.type === "gifv") return true;

    const providerName = embed.provider?.name?.toLowerCase();
    if (providerName && ["tenor", "giphy", "klipy", "gfycat", "redgifs"].includes(providerName)) {
        return true;
    }

    const sourceHost = extractRealHost(embed.url);
    if (hostMatchesKnownGifDomain(sourceHost)) return true;
    if (isImgurGifv(sourceHost, embed.url)) return true;
    if (isLikelyTwitterAnimatedMedia(sourceHost, embed.url)) return true;

    const imageHost = extractRealHost(embed.image?.url);
    if (hostMatchesKnownGifDomain(imageHost)) return true;
    if (isImgurGifv(imageHost, embed.image?.url)) return true;
    if (isLikelyTwitterAnimatedMedia(imageHost, embed.image?.url)) return true;
    if (embed.image?.url && /\.gif(?:[?#]|$)/i.test(embed.image.url)) return true;

    
    const videoHost = extractRealHost(embed.video?.url);
    if (hostMatchesKnownGifDomain(videoHost)) return true;
    if (isLikelyTwitterAnimatedMedia(videoHost, embed.video?.url)) return true;

    return false;
}

function attachmentIsGif(attachment: MessageAttachment): boolean {
    if (attachment.content_type?.startsWith("image/gif")) return true;
    if (/\.gif(?:[?#]|$)/i.test(attachment.filename ?? "")) return true;
    return false;
}

export function hasGif(message: Message): boolean {
    if (message.attachments?.some(attachmentIsGif)) return true;
    if (message.embeds?.some(embedIsGif)) return true;
    return false;
}

let excludeGifs = false;

function ExcludeGifsToggle() {
    const [checked, setChecked] = useState(excludeGifs);

    return (
        <div className={cl("toggle")}>
            <span className={cl("toggle-label")}>Hide GIFs</span>
            <Switch
                checked={checked}
                onChange={value => {
                    excludeGifs = value;
                    setChecked(value);
                }}
            />
        </div>
    );
}

export default definePlugin({
    name: "GifIgnore",
    description: "Adds a toggle to exclude GIFs from search results\nAfter switching the toggle redo de search",
    tags: ["Chat", "Utility"],
    authors: [EquicordDevs.Deegor],

    patches: [
        {
            find: "searchResultsPaginationKey",
            replacement: {
                match: /(\(0,\i\.jsx\)\(\i\.\$,\{variant:"secondary",onClick:\i,text:\i,icon:\i\.R,size:"sm"\}\))/,
                replace: "$1,$self.renderToggle()"
            }
        },
        {
            find: "searchResultsPaginationKey",
            replacement: {
                match: /messages:(\i),(.{0,300}?)(\i)=(\i)\.useRef\(null\)/,
                replace: "messages:$1,$2$3=($1=$self.filterMessages($1),$4.useRef(null))"
            }
        }
    ],

    renderToggle() {
        return <ExcludeGifsToggle />;
    },

    filterMessages(messages: Message[]) {
        if (!excludeGifs) return messages;
        return messages.filter(message => !hasGif(message));
    },

    hasGif
});
