/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";

const Quality = {
    High: 1,
    Reasonable: 2,
    Low: 3,
    Horrible: 4,
} as const;
type Quality = typeof Quality[keyof typeof Quality];

const qualities = [
    { giphy: "giphy", tenor: "Ax", cap: 480 }, // webp
    { giphy: "480w", tenor: "A5", cap: 360 }, // webppreview
    { giphy: "200", tenor: "A1", cap: 200 }, // tinywebp
    { giphy: "100", tenor: "A2", cap: 120 }, // nanowebp
];

const mediaTenorLinkRegex = /^https:\/\/(?:media\d?|c)\.tenor\.com(?:\/m)?\/(?<id>.+?)(?<quality>.{2})\/(?<name>[^/]+)\./i;
const giphyLinkRegex = /^https:\/\/media\d?\.giphy\.com\/media\/.*?\/(?<code>.*?)\/giphy/i;
const mediaProxyParser = /^https:\/\/images-ext-\d\.discordapp.net\/external\/.*?\.*?\/(?<protocol>.*?)\/(?<rest>.*?)$/i;

function getCleanLink(link: string) {
    const normalized = link.startsWith("//") ? `https:${link}` : link;
    const match = normalized.match(mediaProxyParser);
    if (!match) return normalized;
    const { protocol, rest } = match.groups!;
    return `${decodeURIComponent(protocol)}://${decodeURIComponent(rest)}`;
}

const settings = definePluginSettings({
    gifQuality: {
        type: OptionType.SELECT,
        description: "GIF quality",
        options: [
            { label: "High", value: Quality.High, default: true },
            { label: "Reasonable", value: Quality.Reasonable },
            { label: "Low", value: Quality.Low },
            { label: "Horrible", value: Quality.Horrible },
        ],
    },
});

export default definePlugin({
    name: "BetterGifLoad",
    description: "Allows you to change the quality of GIFs in the GIF picker",
    tags: ["Media", "Utility"],
    authors: [EquicordDevs.Leon135, EquicordDevs.nexpid],
    settings,
    patches: [
        {
            find: '"GIFPickerViewStore"',
            replacement: [
                {
                    match: /\?(\i\.\i\.IMAGE):\i\.\i\.VIDEO/,
                    replace: "?$1:$1",
                },
                {
                    match: /(GIF_PICKER_QUERY_SUCCESS.{0,200}width:(\i),height:(\i),)src:(\i\(\i\)),gifSrc:(\i\(\i\))/,
                    replace: "$1src:$self.parseLink($4,[$2,$3]),gifSrc:$self.parseLink($5,[$2,$3])",
                },
                {
                    match: /(GIF_PICKER_TRENDING_FETCH_SUCCESS.{0,400})src:(\i\(\i\.trendingGIFPreview\.src\))/,
                    replace: "$1src:$self.parseLink($2)",
                },
                {
                    match: /src:(\i\(\i\.src\))(,type:\i\.\i\.TRENDING_CATEGORY,)/,
                    replace: "src:$self.parseLink($1)$2",
                },
            ]
        },
    ],
    parseLink(link: string, sizes?: [width: number, height: number]) {
        const quality = settings.store.gifQuality;
        const q = qualities[quality - 1] ?? qualities[0];
        const url: URL = new URL(link.startsWith("//") ? `https:${link}` : link);

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
});
