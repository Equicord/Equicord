/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { sleep } from "@utils/misc";
import type { PluginNative } from "@utils/types";
import { applyPalette, GIFEncoder, quantize } from "gifenc";
import { decompressFrames, parseGIF } from "gifuct-js";

import { CAPTIONS } from "../captions";
import { measureTextLines } from "../captions/caption";
import type { GifMakerOptions } from "../types";

const MAX_FRAMES = 200;
const INTERNAL_FPS = 30;
const PALETTE_COLORS = 255;
const MAX_GIF_SCAN_BYTES = 524288; // 512KB

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

async function fetchFullGifBytes(url: string): Promise<Uint8Array> {
    const resolved = resolveMediaUrl(url);
    if (MediaNative) {
        const { data } = await MediaNative.fetchMedia(resolved);
        return new Uint8Array(data);
    }
    const res = await fetch(resolved);
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
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
    delays?: number[],
): Promise<Blob> {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return new Blob();
    const captionHeight = getCaptionHeight(ctx, width, options);
    const gifHeight = height + captionHeight;
    canvas.width = width;
    canvas.height = gifHeight;

    const defaultDelay = Math.round(1000 / INTERNAL_FPS);

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
            delay: delays ? delays[i] : defaultDelay,
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
            Math.floor(duration * INTERNAL_FPS),
            MAX_FRAMES
        );

        const interval = duration / frameCount;
        const delay = Math.round(interval * 1000);
        const delays = new Array(frameCount).fill(delay);

        return await encodeFrames(options.width, options.height, options, frameCount, async (ctx, i) => {
            video.currentTime = i * interval;
            await waitForSeek(video);
            ctx.drawImage(video, 0, 0, options.width, options.height);
        }, delays);
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
    if (hasExt(url, ".gif")) {
        try {
            return await createGifFromAnimatedImage(url, options);
        } catch (err) {
            if (!(err instanceof Error) || err.message !== "No animated frames found") {
                throw err;
            }
        }
    }
    return createGifFromImage(url, options);
}

export function parseGifBytes(bytes: Uint8Array): SourceFrameInfo | null {
    if (bytes[0] !== 0x47 || bytes[1] !== 0x49 || bytes[2] !== 0x46) return null;

    const frameWidth = bytes[6] | (bytes[7] << 8);
    const frameHeight = bytes[8] | (bytes[9] << 8);

    let frameCount = 0;
    let totalDelay = 0;
    let delayCount = 0;

    const scanLimit = Math.min(bytes.length, MAX_GIF_SCAN_BYTES);
    for (let i = 0; i < scanLimit - 8; i++) {
        if (bytes[i] === 0x2C) {
            frameCount++;
            if (frameCount > MAX_FRAMES) break;
        }
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
}

export async function getGifInfo(url: string): Promise<SourceFrameInfo | null> {
    try {
        const resolved = resolveMediaUrl(url);

        let bytes: Uint8Array;

        if (MediaNative) {
            const { data } = await MediaNative.fetchMedia(resolved);
            bytes = new Uint8Array(data);
        } else {
            bytes = await fetchGifBytes(resolved);
        }

        return parseGifBytes(bytes);
    } catch {
        return null;
    }
}

async function fetchGifBytes(url: string): Promise<Uint8Array> {
    const res = await fetch(url, {
        headers: { Range: `bytes=0-${MAX_GIF_SCAN_BYTES}` }
    });
    if (res.ok) {
        return new Uint8Array(await res.arrayBuffer());
    }

    const full = await fetch(url);
    if (!full.ok) throw new Error(`fetch failed: ${full.status}`);
    const reader = full.body?.getReader();
    if (!reader) return new Uint8Array(await full.arrayBuffer()).slice(0, MAX_GIF_SCAN_BYTES);
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (total < MAX_GIF_SCAN_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        total += value.length;
    }
    reader.cancel();
    const combined = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
    }
    return combined;
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
    const bytes = await fetchFullGifBytes(url);
    const parsedGif = parseGIF(bytes.buffer as ArrayBuffer);
    const frames = decompressFrames(parsedGif, true);

    if (frames.length <= 1) throw new Error("No animated frames found");

    const gifW = parsedGif.lsd.width;
    const gifH = parsedGif.lsd.height;

    const composite = document.createElement("canvas");
    composite.width = gifW;
    composite.height = gifH;
    const ctx = composite.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Failed to get canvas context for GIF compositing.");

    const patchCanvas = document.createElement("canvas");

    const totalFrames = frames.length;
    const rendered: HTMLCanvasElement[] = [];
    const delays: number[] = [];

    for (let i = 0; i < totalFrames; i++) {
        const frame = frames[i];
        delays.push(frame.delay);

        if (i > 0) {
            const prev = frames[i - 1];
            if (prev.disposalType === 2) {
                ctx.clearRect(prev.dims.left, prev.dims.top, prev.dims.width, prev.dims.height);
            } else if (prev.disposalType === 3 && i > 1) {
                const prevCtx = rendered[i - 2].getContext("2d");
                if (prevCtx) {
                    const prevState = prevCtx.getImageData(0, 0, gifW, gifH);
                    ctx.putImageData(prevState, 0, 0);
                }
            }
        }

        const patchData = new ImageData(
            new Uint8ClampedArray(frame.patch),
            frame.dims.width,
            frame.dims.height
        );
        patchCanvas.width = frame.dims.width;
        patchCanvas.height = frame.dims.height;
        const patchCtx = patchCanvas.getContext("2d");
        if (!patchCtx) throw new Error("Failed to get canvas context for patch rendering.");
        patchCtx.putImageData(patchData, 0, 0);
        ctx.drawImage(patchCanvas, frame.dims.left, frame.dims.top);

        const snap = document.createElement("canvas");
        snap.width = gifW;
        snap.height = gifH;
        const snapCtx = snap.getContext("2d");
        if (!snapCtx) throw new Error("Failed to get canvas context for frame snapshot.");
        snapCtx.drawImage(composite, 0, 0);
        rendered.push(snap);

        if (i % 20 === 19) {
            await sleep(0);
        }
    }

    return await encodeFrames(
        options.width, options.height, options, totalFrames,
        (encodeCtx, i) => {
            encodeCtx.drawImage(rendered[i], 0, 0, options.width, options.height);
        },
        delays
    );
}
