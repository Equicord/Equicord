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

// Qualities are reverse engineered, cap is the maximum dimension in pixels
const qualities = [
    { giphy: "giphy", tenor: "Ax", cap: 480, video: "Po" }, // High ~ 480-native
    { giphy: "480w", tenor: "A5", cap: 360, video: "P3" }, // Reasonable ~ 360
    { giphy: "200", tenor: "A1", cap: 200, video: "P2" }, // Low ~ 200
    { giphy: "100", tenor: "A2", cap: 120, video: "P4" }, // Horrible ~ 120
];

const mediaTenorRegex = /^https:\/\/(?:media\d?|c)\.tenor\.com(?:\/m)?\/(?<id>.+?)(?<quality>\w{2})\/(?<name>[^/]+)\.(?<ext>gif|webp|mp4|webm)$/i;
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
    description: "Change the quality of GIFs in the GIF picker. Improves performance and lowers internet usage.",
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
                    replace: "$1src:$self.parseLink($4,[$2,$3],true),gifSrc:$self.parseLink($5,[$2,$3],true)",
                },
                {
                    match: /(GIF_PICKER_TRENDING_FETCH_SUCCESS.{0,400})src:(\i\(\i\.trendingGIFPreview\.src\))/,
                    replace: "$1src:$self.parseLink($2,undefined,true)",
                },
                {
                    match: /src:(\i\(\i\.src\))(,type:\i\.\i\.TRENDING_CATEGORY,)/,
                    replace: "src:$self.parseLink($1,undefined,true)$2",
                },
            ]
        },
        {
            find: "renderEmptyFavorite",
            replacement: [
                {
                    match: /src:\(\i=.{0,300}"animated","true"\),\i\.toString\(\)\):\i\),/,
                    replace: "src:$self.parseLink(this.props.src,[this.props.coords.width,this.props.coords.height]),",
                },
                {
                    match: /(this\.handleCanPlay,\i)\.src=(\i)/,
                    replace: "$1.src=$self.parseLink(this.props.src,[this.props.coords.width,this.props.coords.height])",
                },
            ],
        },
    ],
    parseLink(link: string, sizes?: [width: number, height: number], forceImage?: boolean) {
        const quality = settings.store.gifQuality;
        const q = qualities[quality - 1] ?? qualities[0];
        const url: URL = new URL(link.startsWith("//") ? `https:${link}` : link);

        const cleanLink = getCleanLink(link);

        const tenorMatch = cleanLink.match(mediaTenorRegex);
        if (tenorMatch) {
            const { id, name, ext } = tenorMatch.groups!;
            const isVideo = !forceImage && (ext === "mp4" || ext === "webm");
            return `https://media.tenor.com/${id}${isVideo ? q.video : q.tenor}/${name}.${isVideo ? ext : "webp"}`;
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
