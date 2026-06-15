/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { sleep } from "@utils/misc";
import type { PluginNative } from "@utils/types";
import { applyPalette, GIFEncoder, quantize } from "gifenc";

import { CAPTIONS } from "../captions";
import { measureTextLines } from "../captions/caption";
import type { GifMakerOptions } from "../types";

const MAX_FRAMES = 50;
const INTERNAL_FPS = 10;
const INTERNAL_MAX_DURATION = 3;
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

const MediaNative = VencordNative?.pluginHelpers?.gifMaker as PluginNative<typeof import("../native")> | undefined;

const blobUrlMap = new WeakMap<HTMLElement, string>();

function isDiscordCdnUrl(url: string): boolean {
    try {
        return ALLOWED_MEDIA_HOSTS.has(new URL(url).hostname);
    } catch {
        return false;
    }
}

async function getMediaBlobUrl(url: string): Promise<string> {
    if (MediaNative) {
        const { data, type } = await MediaNative.fetchMedia(url);
        if (data) return URL.createObjectURL(new Blob([data], { type }));
    }
    const res = await fetch(url);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
}

const mediaProxyParser = /^https:\/\/(?:images-ext-\d+|cdn)\.discord(?:app|cdn)\.net\/external\/[^/]+\/(?<protocol>https?)\/(?<rest>.+)$/i;

function resolveMediaUrl(url: string): string {
    const normalized = url.startsWith("//") ? `https:${url}` : url;
    const match = normalized.match(mediaProxyParser);
    if (match?.groups) {
        const { protocol, rest } = match.groups;
        return `${decodeURIComponent(protocol)}://${decodeURIComponent(rest)}`;
    }
    return normalized;
}

export function cleanupBlobUrl(el: HTMLElement) {
    const blobUrl = blobUrlMap.get(el);
    if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        blobUrlMap.delete(el);
    }
}

export function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
        img.crossOrigin = "anonymous";

        const resolved = resolveMediaUrl(url);
        if (isDiscordCdnUrl(resolved)) {
            getMediaBlobUrl(resolved).then(blobUrl => {
                blobUrlMap.set(img, blobUrl);
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

export function loadVideo(url: string): Promise<HTMLVideoElement> {
    const resolved = resolveMediaUrl(url);
    if (isDiscordCdnUrl(resolved)) {
        return getMediaBlobUrl(resolved).then(blobUrl =>
            createVideoElement(blobUrl).then(video => {
                blobUrlMap.set(video, blobUrl);
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
        const { lines, lineHeight } = measureTextLines(ctx, options.captionText, options.captionSize, options.fontFamily, width - 20);
        return Math.ceil(lines.length * lineHeight + 20);
    }
    return 0;
}

async function encodeFrames(
    width: number,
    height: number,
    options: GifMakerOptions,
    frameCount: number,
    drawFrame: (ctx: CanvasRenderingContext2D, i: number) => void | Promise<void>,
): Promise<Blob> {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return new Blob();
    const captionHeight = getCaptionHeight(ctx, width, options);
    const gifHeight = height + captionHeight;
    canvas.width = width;
    canvas.height = gifHeight;

    const delay = Math.round(1000 / INTERNAL_FPS);

    const frameData: Uint8ClampedArray[] = [];
    for (let i = 0; i < frameCount; i++) {
        ctx.clearRect(0, 0, width, gifHeight);

        ctx.save();
        ctx.translate(0, captionHeight);
        await drawFrame(ctx, i);
        ctx.restore();

        const caption = CAPTIONS.find(c => c.type === options.captionMode);
        if (caption) {
            ctx.save();
            caption.render(ctx, width, captionHeight > 0 ? captionHeight : height, options);
            ctx.restore();
        }

        frameData.push(ctx.getImageData(0, 0, width, gifHeight).data);
    }

    const totalLength = frameData.reduce((sum, data) => sum + data.length, 0);
    const combined = new Uint8ClampedArray(totalLength);
    let offset = 0;
    for (const data of frameData) {
        combined.set(data, offset);
        offset += data.length;
    }

    const palette = quantize(combined, PALETTE_COLORS);
    const gif = GIFEncoder();

    for (let i = 0; i < frameCount; i++) {
        const index = applyPalette(frameData[i], palette);
        gif.writeFrame(index, width, gifHeight, {
            delay,
            palette: i === 0 ? palette : undefined,
        });
    }

    gif.finish();
    const bytes = gif.bytesView();
    return new Blob([new Uint8Array(bytes.buffer as ArrayBuffer, bytes.byteOffset, bytes.byteLength)], { type: "image/gif" });
}

async function createGifFromImage(url: string, options: GifMakerOptions): Promise<Blob> {
    const img = await loadImage(url);
    try {
        return await encodeFrames(options.width, options.height, options, 1, ctx => {
            ctx.drawImage(img, 0, 0, options.width, options.height);
        });
    } finally {
        cleanupBlobUrl(img);
    }
}

async function createGifFromVideo(url: string, options: GifMakerOptions): Promise<Blob> {
    const video = await loadVideo(url);
    try {
        const { duration } = video;
        const frameCount = Math.min(
            INTERNAL_FPS * INTERNAL_MAX_DURATION,
            Math.floor(duration * INTERNAL_FPS),
            MAX_FRAMES
        );

        const interval = duration / frameCount;

        return await encodeFrames(options.width, options.height, options, frameCount, async (ctx, i) => {
            video.currentTime = i * interval;
            await waitForSeek(video);
            ctx.drawImage(video, 0, 0, options.width, options.height);
        });
    } finally {
        cleanupBlobUrl(video);
    }
}

export interface SourceFrameInfo {
    fps?: number;
    frameCount?: number;
    frameWidth: number;
    frameHeight: number;
}

function hasExt(url: string, ext: string): boolean {
    try {
        const normalized = url.startsWith("//") ? `https:${url}` : url;
        const match = normalized.match(mediaProxyParser);
        const resolved = match?.groups
            ? `${decodeURIComponent(match.groups.protocol)}://${decodeURIComponent(match.groups.rest)}`
            : normalized;
        return new URL(resolved).pathname.toLowerCase().endsWith(ext);
    } catch {
        return url.toLowerCase().endsWith(ext);
    }
}

export async function getSourceFrameInfo(url: string, isVideo: boolean): Promise<SourceFrameInfo | null> {
    if (isVideo) return getVideoSourceInfo(url);
    if (hasExt(url, ".gif")) return getGifInfo(url);
    if (hasExt(url, ".webp")) return getWebpInfo(url);
    return null;
}

export async function createGif(url: string, isVideo: boolean, options: GifMakerOptions): Promise<Blob> {
    if (isVideo) return createGifFromVideo(url, options);
    const info = await getSourceFrameInfo(url, false);
    if (info?.frameCount && info.frameCount > 1) {
        return createGifFromAnimatedImage(url, options);
    }
    return createGifFromImage(url, options);
}

export async function getGifInfo(url: string): Promise<SourceFrameInfo | null> {
    if (!MediaNative) return null;
    try {
        const resolved = resolveMediaUrl(url);
        const { data } = await MediaNative.fetchMedia(resolved);
        const bytes = new Uint8Array(data);

        if (bytes[0] !== 0x47 || bytes[1] !== 0x49 || bytes[2] !== 0x46) return null;

        const frameWidth = bytes[6] | (bytes[7] << 8);
        const frameHeight = bytes[8] | (bytes[9] << 8);

        let frameCount = 0;
        let totalDelay = 0;
        let delayCount = 0;

        for (let i = 0; i < bytes.length - 8; i++) {
            if (bytes[i] === 0x2C) frameCount++;
            if (bytes[i] === 0x21 && bytes[i + 1] === 0xF9 && bytes[i + 2] === 0x04) {
                const delay = bytes[i + 4] | (bytes[i + 5] << 8);
                if (delay > 0) {
                    totalDelay += delay;
                    delayCount++;
                }
            }
        }

        if (frameCount > 1 && delayCount > 0) {
            const avgFps = Math.round(100 / (totalDelay / delayCount));
            return { fps: Math.max(1, Math.min(60, avgFps)), frameCount, frameWidth, frameHeight };
        }
        return null;
    } catch {
        return null;
    }
}

async function getWebpInfo(url: string): Promise<SourceFrameInfo | null> {
    if (!MediaNative) return null;
    try {
        const resolved = resolveMediaUrl(url);
        const { data } = await MediaNative.fetchMedia(resolved);
        const bytes = new Uint8Array(data);

        if (bytes[0] !== 0x52 || bytes[1] !== 0x49 || bytes[2] !== 0x46 || bytes[3] !== 0x46 ||
            bytes[8] !== 0x57 || bytes[9] !== 0x45 || bytes[10] !== 0x42 || bytes[11] !== 0x50) {
            return null;
        }

        let hasAnimation = false;
        let canvasWidth = 0;
        let canvasHeight = 0;
        let frameCount = 0;
        let totalDelay = 0;
        let delayCount = 0;

        let offset = 12;
        while (offset + 8 <= bytes.length) {
            const chunkSize = bytes[offset + 4] | (bytes[offset + 5] << 8) | (bytes[offset + 6] << 16) | (bytes[offset + 7] << 24);
            const fourCC = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);

            if (fourCC === "VP8X" && offset + 18 <= bytes.length) {
                hasAnimation = !!(bytes[offset + 8] & 0x02);
                canvasWidth = ((bytes[offset + 12] | (bytes[offset + 13] << 8) | (bytes[offset + 14] << 16)) & 0xFFFFFF) + 1;
                canvasHeight = ((bytes[offset + 15] | (bytes[offset + 16] << 8) | (bytes[offset + 17] << 16)) & 0xFFFFFF) + 1;
            } else if (fourCC === "ANMF" && offset + 23 <= bytes.length) {
                frameCount++;
                const delayMs = bytes[offset + 20] | (bytes[offset + 21] << 8) | (bytes[offset + 22] << 16);
                if (delayMs > 0) {
                    totalDelay += delayMs;
                    delayCount++;
                }
            }

            offset += 8 + chunkSize;
            if (chunkSize % 2 === 1) offset++;
        }

        if (hasAnimation && frameCount > 1 && delayCount > 0) {
            const avgFps = Math.round(1000 / (totalDelay / delayCount));
            return { fps: Math.max(1, Math.min(60, avgFps)), frameCount, frameWidth: canvasWidth, frameHeight: canvasHeight };
        }
        return null;
    } catch {
        return null;
    }
}

async function getVideoSourceInfo(url: string): Promise<SourceFrameInfo | null> {
    try {
        const resolved = resolveMediaUrl(url);
        let src: string;
        let needsCleanup = false;

        if (isDiscordCdnUrl(resolved)) {
            src = await getMediaBlobUrl(resolved);
            needsCleanup = true;
        } else {
            src = resolved;
        }

        return new Promise(resolve => {
            const v = document.createElement("video");
            v.preload = "metadata";
            v.muted = true;
            v.crossOrigin = "anonymous";

            v.addEventListener("loadedmetadata", () => {
                const info: SourceFrameInfo = { frameWidth: v.videoWidth, frameHeight: v.videoHeight };
                if (needsCleanup) URL.revokeObjectURL(src);
                v.remove();
                resolve(info);
            }, { once: true });

            v.addEventListener("error", () => {
                if (needsCleanup) URL.revokeObjectURL(src);
                v.remove();
                resolve(null);
            }, { once: true });

            v.src = src;
            v.load();
        });
    } catch {
        return null;
    }
}

async function createGifFromAnimatedImage(url: string, options: GifMakerOptions): Promise<Blob> {
    const resolved = resolveMediaUrl(url);
    const img = new Image();
    img.crossOrigin = "anonymous";

    const wrapper = document.createElement("div");
    wrapper.className = "vc-gifmaker-capture-wrapper";
    wrapper.appendChild(img);
    document.body.appendChild(wrapper);

    await new Promise<void>((resolve, reject) => {
        img.onload = () => {
            setTimeout(() => resolve(), 200);
        };
        img.onerror = () => {
            wrapper.remove();
            reject(new Error(`Failed to load: ${url}`));
        };
        if (isDiscordCdnUrl(resolved)) {
            getMediaBlobUrl(resolved).then(blobUrl => {
                blobUrlMap.set(img, blobUrl);
                img.src = blobUrl;
            }).catch(reject);
        } else {
            img.src = resolved;
        }
    });

    try {
        const frameCount = Math.min(INTERNAL_FPS * INTERNAL_MAX_DURATION, MAX_FRAMES);
        const interval = 1000 / INTERNAL_FPS;

        return await encodeFrames(options.width, options.height, options, frameCount, async (ctx, i) => {
            if (i > 0) {
                await sleep(interval);
            }
            ctx.drawImage(img, 0, 0, options.width, options.height);
        });
    } finally {
        wrapper.remove();
        cleanupBlobUrl(img);
    }
}
