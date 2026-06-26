/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const URL_KEYWORDS = ["url", "src", "proxy"];
const URL_CONTAINER_KEYS = ["gif", "media", "image", "video", "thumbnail", "preview", "result", "item"];

export function normalizeUrl(url: string) {
    return url.startsWith("//") ? `https:${url}` : url;
}

export function looksLikeUrl(value: string) {
    return value.startsWith("http://") || value.startsWith("https://") || value.startsWith("//");
}

export function collectCandidateUrls(source: unknown, depth = 0, out = new Set<string>()) {
    if (!source || depth > 2) return out;

    if (typeof source === "string") {
        if (looksLikeUrl(source)) out.add(normalizeUrl(source));
        return out;
    }

    if (Array.isArray(source)) {
        for (const entry of source) collectCandidateUrls(entry, depth + 1, out);
        return out;
    }

    if (typeof source !== "object") return out;

    for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
        const keyLower = key.toLowerCase();

        if (typeof value === "string") {
            if (looksLikeUrl(value) && URL_KEYWORDS.some(keyword => keyLower.includes(keyword))) {
                out.add(normalizeUrl(value));
            }
            continue;
        }

        if (value && typeof value === "object" && URL_CONTAINER_KEYS.some(keyword => keyLower.includes(keyword))) {
            collectCandidateUrls(value, depth + 1, out);
        }
    }

    return out;
}

export function scoreUrl(url: string) {
    const { host } = new URL(url);

    let score = 0;
    if (host.endsWith("discordapp.net") || host.endsWith("discordapp.com")) score += 100;
    if (host.includes("images-ext")) score += 20;
    if (host.includes("media.discordapp.net") || host.includes("cdn.discordapp.com")) score += 10;
    if (host.endsWith("klipy.com")) score += 5;
    if (host.endsWith("tenor.com")) score += 5;
    if (url.includes(".gif")) score += 1;

    return score;
}

export function orderCandidateUrls(preferred: string | null, candidates: Set<string>) {
    const all = Array.from(candidates);
    if (!all.length) return [];

    const rest = preferred ? all.filter(url => url !== preferred) : all;
    rest.sort((a, b) => scoreUrl(b) - scoreUrl(a));

    return preferred ? [preferred, ...rest] : rest;
}

export function isLikelyVideoUrl(url: string) {
    return /\.(webm|mp4|m4v)(\?|$)/i.test(url);
}

export function ensureGifUrl(url: string): string {
    if (/\.gif(\?|$)/i.test(url)) return url;

    const parsed = new URL(url);
    const host = parsed.hostname;

    if (host.includes("tenor.com")) {
        const paths = parsed.pathname.split("/").filter(Boolean);
        if (paths.length >= 2) {
            const idSegment = paths[paths.length - 2];
            paths[paths.length - 2] = idSegment.replace(/[PA].$/, "Ad");
            paths[paths.length - 1] = "tenor.gif";
            parsed.pathname = "/" + paths.join("/");
        }
        parsed.search = "";
        return parsed.href;
    }

    if (host.includes("giphy.com")) {
        const paths = parsed.pathname.split("/").filter(Boolean);
        if (paths.length >= 2) {
            const gifId = paths[paths.length - 2];
            return `https://i.giphy.com/${gifId}.gif`;
        }
        return url;
    }

    return url;
}

export function stripDiscordFormatParam(url: string): string {
    const parsed = new URL(url);
    if (/discord(app)?\.(com|net|gg)/i.test(parsed.hostname)) {
        parsed.searchParams.delete("format");
        parsed.searchParams.delete("animated");
    }
    return parsed.href;
}
