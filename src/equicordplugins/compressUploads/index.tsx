/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EquicordDevs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin, { PluginNative } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { showToast, Toasts, UserStore } from "@webpack/common";

import { settings } from "./settings";
import { CompressChatBarIcon, CompressIcon } from "./SettingsModal";
import { beginCompressing, endCompressing } from "./state";

const logger = new Logger("CompressUploads");

const Native = IS_DISCORD_DESKTOP
    ? (VencordNative.pluginHelpers.CompressUploads as PluginNative<typeof import("./native")>)
    : null;
const { getUserMaxFileSize } = findByPropsLazy("getUserMaxFileSize");
const SUPPORTED_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg"]);

function getExtension(file: File): string {
    return file.name.match(/\.[^.]+$/)?.[0].toLowerCase() ?? "";
}

function isCompressibleImage(file: File): boolean {
    return (file.type.startsWith("image/") || SUPPORTED_IMAGE_EXTENSIONS.has(getExtension(file)))
        && file.type !== "image/gif"
        && getExtension(file) !== ".gif";
}

function getUploadFile(value: unknown): File | null {
    if (value instanceof File) return value;
    if (!value || typeof value !== "object") return null;
    if ("file" in value && value.file instanceof File) return value.file;

    const item = "item" in value && value.item && typeof value.item === "object" ? value.item : null;
    return item && "file" in item && item.file instanceof File ? item.file : null;
}

function formatMB(bytes: number): string {
    return (bytes / 1024 / 1024).toFixed(1);
}

function cancelUpload(upload: any) {
    try {
        if (typeof upload.cancel === "function") upload.cancel();
        else upload.setStatus("CANCELED");
    } catch (e) {
        logger.error("Failed to cancel upload:", e);
    }
}

function isOverUploadLimit(file: File): boolean {
    const maxFileSize = getUserMaxFileSize(UserStore.getCurrentUser());
    return Number.isFinite(maxFileSize) && file.size > maxFileSize;
}

function minSavedFraction() {
    const pct = Math.min(90, Math.max(0, Number(settings.store.minSavingsPercent) || 0));
    return 1 - pct / 100;
}

async function compressImage(file: File): Promise<File> {
    if (!isCompressibleImage(file)) return file;
    const maxFileSize = getUserMaxFileSize(UserStore.getCurrentUser());
    const isOverLimit = Number.isFinite(maxFileSize) && file.size > maxFileSize;

    const canvas = await decodeStandardImage(file);

    const lossyQuality = Math.min(1, Math.max(0.1, Number(settings.store.imageQuality) || 0.85));
    const preferLossless = settings.store.losslessImages;
    let blob = await canvas.convertToBlob({ type: "image/webp", quality: preferLossless ? 1 : lossyQuality });
    const doesNotMeetTarget = blob.size >= file.size * minSavedFraction() || (isOverLimit && blob.size > maxFileSize);

    if (preferLossless && doesNotMeetTarget) {
        blob = await canvas.convertToBlob({ type: "image/webp", quality: lossyQuality });
    }

    logger.debug("Image", file.size, "->", blob.size);
    if (blob.size >= file.size * minSavedFraction() && (!isOverLimit || blob.size > maxFileSize)) return file;

    return new File([blob], file.name.replace(/\.\w+$/, ".webp"), { type: "image/webp" });
}

async function decodeStandardImage(file: File): Promise<OffscreenCanvas> {
    const bitmap = await createImageBitmap(file);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);

    try {
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Could not get a 2d context");
        context.drawImage(bitmap, 0, 0);
    } finally {
        bitmap.close();
    }

    return canvas;
}

async function compressVideo(file: File): Promise<File> {
    if (!Native) {
        logger.debug("No native helper, skipping video compression");
        return file;
    }

    const maxFileSize = getUserMaxFileSize(UserStore.getCurrentUser());
    const isOverLimit = Number.isFinite(maxFileSize) && file.size > maxFileSize;
    const startedAt = performance.now();
    const bytes = new Uint8Array(await file.arrayBuffer());
    const res = await Native.compressVideo(bytes, {
        ffmpegPath: settings.store.ffmpegPath,
        crf: Number(settings.store.videoCrf),
        h265: settings.store.h265,
        maxHeight: Number(settings.store.videoMaxHeight),
        preset: settings.store.videoPreset,
        audioKbps: Number(settings.store.audioKbps),
        maxSize: maxFileSize,
        ext: file.name.match(/\.\w+$/)?.[0] ?? ".mp4"
    });
    logger.debug(
        "Video", res.inSize, "->", res.outSize, res.capped ? "(bitrate-capped)" : "(stepped fallback)",
        `${res.attempts} encode(s), ${((performance.now() - startedAt) / 1000).toFixed(1)}s`
    );

    if (res.error) {
        logger.error("Video compression failed:", res.error);
        if (settings.store.notifyOnError) {
            showToast("Video compression failed, sending the original file. Check that ffmpeg works.", Toasts.Type.FAILURE);
        }
    }

    if (!res.data || (res.outSize >= res.inSize * minSavedFraction() && (!isOverLimit || res.outSize > maxFileSize))) return file;

    const buffer = new ArrayBuffer(res.data.byteLength);
    new Uint8Array(buffer).set(res.data);
    return new File([buffer], file.name.replace(/\.\w+$/, ".mp4"), { type: "video/mp4" });
}

const compressionCache = new Map<string, Promise<File>>();
const MAX_CACHE_ENTRIES = 8;

// Re-dropping or retrying the same file would otherwise re-encode it from scratch.
function compressCached(file: File, isVideo: boolean): Promise<File> {
    const s = settings.store;
    const key = [
        isVideo ? "v" : "i", file.name, file.size, file.lastModified,
        s.minSavingsPercent, s.losslessImages, s.imageQuality,
        s.videoCrf, s.h265, s.videoMaxHeight, s.videoPreset, s.audioKbps
    ].join("|");

    let job = compressionCache.get(key);
    if (!job) {
        job = isVideo ? compressVideo(file) : compressImage(file);
        compressionCache.set(key, job);
        job.catch(() => compressionCache.delete(key));

        if (compressionCache.size > MAX_CACHE_ENTRIES) {
            const oldest = compressionCache.keys().next().value;
            if (oldest !== undefined) compressionCache.delete(oldest);
        }
    }
    return job;
}

async function compressUpload(upload: any): Promise<void> {
    if (!settings.store.enabled) return;

    const file = upload?.item?.file;
    logger.debug("upload()", upload?.filename, file?.size);
    if (!(file instanceof File)) {
        logger.debug("No File on upload.item");
        return;
    }

    if (!settings.store.compressOversized && isOverUploadLimit(file)) return;

    const minBytes = Math.max(0, Number(settings.store.minSizeKB) || 0) * 1024;
    if (file.size < minBytes) return;

    const isVideo = file.type.startsWith("video/");
    const isImage = isCompressibleImage(file);
    if (isVideo && !settings.store.enableVideos) return;
    if (isImage && !settings.store.enableImages) return;
    if (!isVideo && !isImage) return;

    const out = await compressCached(file, isVideo);
    if (out === file) return;

    upload.item.file = out;
    upload.currentSize = out.size;
    upload.postCompressionSize = out.size;
    try { upload.filename = out.name; } catch { }
    try { upload.mimeType = out.type; } catch { }
    logger.debug("Swapped file:", file.size, "->", out.size);
}

export default definePlugin({
    name: "CompressUploads",
    description: "Compresses images and videos before upload",
    tags: ["Utility", "Media"],
    authors: [EquicordDevs.PehCake],
    settings,

    chatBarButton: {
        icon: CompressIcon,
        render: CompressChatBarIcon
    },

    patches: [
        {
            find: 'this.setStatus("STARTED"),this.startTime=performance.now()',
            replacement: {
                match: /async upload\(\)\{if\("COMPLETED"===this\.status\)return;/,
                replace: "$&this.setStatus(\"STARTED\"),this.startTime=performance.now();if(await $self.processUpload(this))return;"
            }
        },
        {
            find: "#{intl::UPLOAD_AREA_TOO_LARGE_HELP_PREMIUM_TIER_1}",
            replacement: {
                match: /(?<=#{intl::UPLOAD_AREA_TOO_LARGE_HELP}.{0,250})Array\.from\((\i)\)\.some/,
                replace: "$self.shouldBypassDiscordUploadSizeCheck(Array.from($1))?false:$&"
            }
        }
    ],

    shouldBypassDiscordUploadSizeCheck(items: unknown[]): boolean {
        if (!settings.store.enabled || !settings.store.compressOversized) return false;

        const files = items.map(getUploadFile).filter((file): file is File => file !== null);
        if (files.length === 0 || files.length !== items.length) return false;

        return files.every(file => {
            if (isCompressibleImage(file)) return settings.store.enableImages;
            if (file.type.startsWith("video/")) return Boolean(Native) && settings.store.enableVideos;
            return false;
        });
    },

    /**
     * Compresses the upload's file, then checks it against the user's upload limit.
     * Resolves to true if the upload was cancelled because it is still too large.
     */
    processUpload(upload: any): Promise<boolean> {
        if (!settings.store.enabled) return Promise.resolve(false);

        upload.__compressUploadsJob ??= (async () => {
            beginCompressing();

            try {
                try {
                    await compressUpload(upload);
                } catch (e) {
                    logger.error("Failed to compress upload:", e);
                }

                const file = upload?.item?.file;
                if (settings.store.compressOversized && file instanceof File && isOverUploadLimit(file)) {
                    const maxFileSize = getUserMaxFileSize(UserStore.getCurrentUser());
                    showToast(
                        `"${file.name}" is still ${formatMB(file.size)} MB after compression (limit ${formatMB(maxFileSize)} MB). Upload cancelled.`,
                        Toasts.Type.FAILURE
                    );
                    cancelUpload(upload);
                    return true;
                }

                return false;
            } finally {
                endCompressing();
            }
        })();

        return upload.__compressUploadsJob;
    }
});
