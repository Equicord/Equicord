/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { PluginNative } from "@utils/types";
import { applyPalette, GIFEncoder, quantize } from "gifenc";

import { CAPTIONS } from "./captions";
import { measureTextLines } from "./captions/caption";
import { EFFECTS } from "./effects";
import { EffectDefinition, GifMakerOptions } from "./types";

const Native = VencordNative.pluginHelpers.GifMaker as PluginNative<typeof import("./native")>;

const MAX_VIDEO_FRAMES = 50;
const PALETTE_COLORS = 255;

const ALLOWED_MEDIA_HOSTS = new Set([
    "cdn.discordapp.com",
    "images-ext-1.discordapp.net",
    "images-ext-2.discordapp.net",
    "media.discordapp.net",
    "media.tenor.com",
    "tenor.com",
    "media.giphy.com",
    "media0.giphy.com",
    "media1.giphy.com",
    "media2.giphy.com",
    "media3.giphy.com",
    "media4.giphy.com",
]);

function isDiscordCdnUrl(url: string): boolean {
    try {
        return ALLOWED_MEDIA_HOSTS.has(new URL(url).hostname);
    } catch {
        return false;
    }
}

async function getMediaBlobUrl(url: string): Promise<string> {
    const { data, type } = await Native.fetchMedia(url);
    return URL.createObjectURL(new Blob([data], { type }));
}

const mediaProxyParser = /^https:\/\/(?:images-ext-\d+|cdn)\.discord(?:app|cdn)\.net\/external\/[^/]+\/(?<protocol>https?)\/(?<rest>.+)$/i;

function resolveMediaUrl(url: string): string {
    const normalized = url.startsWith("//") ? `https:${url}` : url;
    const match = normalized.match(mediaProxyParser);
    if (match) {
        const { protocol, rest } = match.groups!;
        return `${decodeURIComponent(protocol)}://${decodeURIComponent(rest)}`;
    }
    return normalized;
}

function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
        img.crossOrigin = "anonymous";

        const resolved = resolveMediaUrl(url);
        if (isDiscordCdnUrl(resolved)) {
            getMediaBlobUrl(resolved).then(blobUrl => {
                (img as any).__gifmaker_blobUrl = blobUrl;
                img.src = blobUrl;
            }).catch(reject);
        } else {
            img.src = resolved;
        }
    });
}

function createVideoElement(src: string): Promise<HTMLVideoElement> {
    return new Promise((resolve, reject) => {
        const v = document.createElement("video");
        v.preload = "auto";
        v.muted = true;
        v.crossOrigin = "anonymous";

        v.addEventListener("loadedmetadata", () => {
            const { duration, videoWidth, videoHeight } = v;
            if (!isFinite(duration) || duration <= 0 || !videoWidth || !videoHeight) {
                reject(new Error(`Invalid video: duration=${duration} w=${videoWidth} h=${videoHeight}`));
                return;
            }
            resolve(v);
        }, { once: true });

        v.addEventListener("error", () => {
            reject(new Error(`Video load failed: ${src} (code=${v.error?.code})`));
        }, { once: true });

        v.src = src;
        v.load();
    });
}

function loadVideo(url: string): Promise<HTMLVideoElement> {
    const resolved = resolveMediaUrl(url);
    if (isDiscordCdnUrl(resolved)) {
        return getMediaBlobUrl(resolved).then(blobUrl =>
            createVideoElement(blobUrl).then(video => {
                (video as any).__gifmaker_blobUrl = blobUrl;
                return video;
            })
        );
    }
    return createVideoElement(resolved);
}

function waitForSeek(video: HTMLVideoElement): Promise<void> {
    return new Promise(resolve => {
        if (video.seeking) {
            video.addEventListener("seeked", () => resolve(), { once: true });
        } else {
            resolve();
        }
    });
}

export function getCaptionHeight(ctx: CanvasRenderingContext2D, width: number, options: GifMakerOptions): number {
    if (options.captionMode === "caption" && options.captionText) {
        const { lines, lineHeight } = measureTextLines(ctx, options.captionText, options.captionSize, width - 20);
        return lines.length * lineHeight + 20;
    }
    return 0;
}

async function encodeFrames(
    width: number,
    height: number,
    options: GifMakerOptions,
    enabledEffects: EffectDefinition[],
    frameCount: number,
    drawFrame: (ctx: CanvasRenderingContext2D, i: number) => void | Promise<void>,
): Promise<Blob> {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return new Blob();
    const captionHeight = getCaptionHeight(ctx, width, options);
    canvas.width = width;
    canvas.height = height + captionHeight;

    const gif = GIFEncoder();
    let palette: number[][] | undefined;

    for (let i = 0; i < frameCount; i++) {
        ctx.clearRect(0, 0, width, canvas.height);

        ctx.save();
        ctx.translate(0, captionHeight);
        if (options.grayscale) ctx.filter = "grayscale(1)";
        for (const eff of enabledEffects) {
            eff.beforeDraw?.(ctx, width, height, i, frameCount);
        }
        await drawFrame(ctx, i);
        ctx.restore();

        ctx.save();
        ctx.translate(0, captionHeight);
        for (const eff of enabledEffects) {
            eff.afterDraw?.(ctx, width, height, i, frameCount);
        }
        ctx.restore();

        const caption = CAPTIONS.find(c => c.type === options.captionMode);
        if (caption) {
            ctx.save();
            caption.render(ctx, width, captionHeight > 0 ? captionHeight : height, options);
            ctx.restore();
        }

        const { data } = ctx.getImageData(0, 0, width, canvas.height);

        if (i === 0) {
            palette = quantize(data, PALETTE_COLORS);
        }

        const index = applyPalette(data, palette!);
        gif.writeFrame(index, width, canvas.height, {
            delay: options.frameDelay,
            palette: i === 0 ? palette : undefined,
        });
    }

    gif.finish();
    return new Blob([new Uint8Array(gif.bytesView())], { type: "image/gif" });
}

async function createGifFromImage(url: string, options: GifMakerOptions): Promise<Blob> {
    const img = await loadImage(url);
    try {
        const enabledEffects = EFFECTS.filter(e => options.effectTypes.includes(e.type));
        const frameCount = Math.max(1, ...enabledEffects.map(e => e.frames));

        return await encodeFrames(options.width, options.height, options, enabledEffects, frameCount, ctx => {
            ctx.drawImage(img, 0, 0, options.width, options.height);
        });
    } finally {
        const blobUrl = (img as any).__gifmaker_blobUrl;
        if (blobUrl) URL.revokeObjectURL(blobUrl);
    }
}

async function createGifFromVideo(url: string, options: GifMakerOptions): Promise<Blob> {
    const video = await loadVideo(url);
    try {
        const { duration } = video;
        const enabledEffects = EFFECTS.filter(e => options.effectTypes.includes(e.type));
        const frameCount = Math.max(1, Math.min(
            Math.floor((duration * 1000) / options.frameDelay),
            MAX_VIDEO_FRAMES
        ));

        const interval = duration / frameCount;

        return await encodeFrames(options.width, options.height, options, enabledEffects, frameCount, async (ctx, i) => {
            video.currentTime = i * interval;
            await waitForSeek(video);
            ctx.drawImage(video, 0, 0, options.width, options.height);
        });
    } finally {
        const blobUrl = (video as any).__gifmaker_blobUrl;
        if (blobUrl) URL.revokeObjectURL(blobUrl);
    }
}

export async function createGif(url: string, isVideo: boolean, options: GifMakerOptions): Promise<Blob> {
    if (isVideo) {
        return createGifFromVideo(url, options);
    }
    return createGifFromImage(url, options);
}
