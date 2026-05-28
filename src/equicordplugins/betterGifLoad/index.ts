/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { FluxDispatcher } from "@webpack/common";

enum Quality {
    Highest,
    High,
    Default,
    Reasonable,
    Low,
    Horrible,
}

const qualities = [
    { giphy: "giphy", tenor: "Ax", cap: 480 }, // webp
    { giphy: "480w", tenor: "A5", cap: 360 }, // webppreview
    { giphy: "giphy", tenor: "", cap: 300 }, // no change
    { giphy: "200", tenor: "A1", cap: 200 }, // tinywebp
    { giphy: "100", tenor: "A2", cap: 120 }, // nanowebp
    { giphy: "giphy-preview", tenor: "A4", cap: 90 }, // nanowebppreview
];

const mediaTenorLinkRegex = /^https:\/\/(?:media\d?|c)\.tenor\.com(?:\/m)?\/(?<id>.+?)(?<quality>.{2})\/(?<name>[^/]+)\./i;
const giphyLinkRegex = /^https:\/\/media\d?\.giphy\.com\/media\/.*?\/(?<code>.*?)\/giphy/i;
const mediaProxyParser = /^https:\/\/images-ext-\d\.discordapp.net\/external\/.*?\.*?\/(?<protocol>.*?)\/(?<rest>.*?)$/i;

function normalizeLink(link: string) {
    if (link.startsWith("//")) return `https:${link}`;
    return link;
}

function getCleanLink(link: string) {
    const normalized = normalizeLink(link);
    const match = normalized.match(mediaProxyParser);
    if (!match) return normalized;
    const { protocol, rest } = match.groups!;
    return `${decodeURIComponent(protocol)}://${decodeURIComponent(rest)}`;
}

function parseLink(link: string, quality: number, sizes?: [width: number, height: number]) {
    const q = qualities[quality] ?? qualities[Quality.Default];
    let url: URL;
    try {
        url = new URL(normalizeLink(link));
    } catch {
        return link;
    }

    const cleanLink = getCleanLink(link);
    const tenorMatch = cleanLink.match(mediaTenorLinkRegex);
    if (tenorMatch) {
        const { id, name } = tenorMatch.groups!;
        return `https://media.tenor.com/${id}${q.tenor}/${name}.webp`;
    }

    const giphyMatch = cleanLink.match(giphyLinkRegex);
    if (giphyMatch) {
        const { code } = giphyMatch.groups!;
        return `https://i.giphy.com/media/${code}/${q.giphy}.webp`;
    }

    if (url.hostname.endsWith(".discordapp.net") || url.hostname === "cdn.discordapp.com") {
        url.searchParams.set("format", "webp");
        url.searchParams.set("animated", "true");
        if (sizes && sizes.length === 2) {
            const smaller = Math.min(...sizes);
            url.searchParams.set("width", String(Math.floor((sizes[0] / smaller) * q.cap)));
            url.searchParams.set("height", String(Math.floor((sizes[1] / smaller) * q.cap)));
        }
        return url.toString();
    }

    return link;
}

const settings = definePluginSettings({
    gifQuality: {
        type: OptionType.SELECT,
        description: "GIF quality",
        options: [
            { label: "Highest (480px)", value: Quality.Highest },
            { label: "High (360px)", value: Quality.High },
            { label: "Default", value: Quality.Default, default: true },
            { label: "Reasonable (200px)", value: Quality.Reasonable },
            { label: "Low (120px)", value: Quality.Low },
            { label: "Horrible (90px)", value: Quality.Horrible },
        ],
    },
});

let interceptor: ((event: any) => void) | null = null;

export default definePlugin({
    name: "BetterGifLoad",
    description: "Allows you to change the quality of GIFs in the GIF picker",
    tags: ["Media", "Utility"],
    authors: [EquicordDevs.Leon135],
    settings,
    patches: [
        {
            find: /GIF_PICKER_QUERY_SUCCESS:\s*function/,
            replacement: {
                match: /(src:(\i\(\i\)),.+?format:)\i/,
                replace: "$1 1",
            },
        },
    ],

    start() {
        interceptor = createInterceptor(settings);
        FluxDispatcher.addInterceptor(interceptor);
    },

    stop() {
        if (!interceptor) return;
        const list = FluxDispatcher._interceptors ?? [];
        const idx = list.indexOf(interceptor);
        if (idx !== -1) list.splice(idx, 1);
        interceptor = null;
    },
});

function createInterceptor(settings: any) {
    return (event: any) => {
        if (
            event.type !== "GIF_PICKER_QUERY_SUCCESS" &&
            event.type !== "GIF_PICKER_TRENDING_FETCH_SUCCESS" &&
            event.type !== "GIF_PICKER_SUGGESTIONS_SUCCESS"
        ) return;

        const quality = settings.store.gifQuality;
        if (quality === Quality.Default) return;

        const items = event.items ?? event.results ?? [];

        for (const item of items) {
            if (item.src) {
                const normalized = normalizeLink(item.src);
                item.src = parseLink(normalized, quality, [item.width, item.height]);
            }
            if (item.gif_src) {
                const normalized = normalizeLink(item.gif_src);
                item.gif_src = parseLink(normalized, quality, [item.width, item.height]);
            }
            if (item.gifSrc) {
                const normalized = normalizeLink(item.gifSrc);
                item.gifSrc = parseLink(normalized, quality, [item.width, item.height]);
            }
            if (item.preview) {
                const normalized = normalizeLink(item.preview);
                item.preview = parseLink(normalized, quality, [item.width, item.height]);
            }
            if (item.url) {
                const normalized = normalizeLink(item.url);
                item.url = parseLink(normalized, quality, [item.width, item.height]);
            }
        }
    };
}
