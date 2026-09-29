/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType, PluginNative } from "@utils/types";
import { Toasts } from "@webpack/common";

const Native = IS_DISCORD_DESKTOP
    ? (VencordNative.pluginHelpers.CompressUploads as PluginNative<typeof import("./native")>)
    : null;

export const settings = definePluginSettings({
    enableImages: {
        type: OptionType.BOOLEAN,
        description: "Compress images",
        default: true
    },
    enableVideos: {
        type: OptionType.BOOLEAN,
        description: "Compress videos (desktop app only, needs ffmpeg)",
        default: true
    },
    minSizeKB: {
        type: OptionType.NUMBER,
        description: "Skip files smaller than this many KB",
        default: 256
    },
    minSavingsPercent: {
        type: OptionType.NUMBER,
        description: "Only use the compressed file if it is at least this much smaller (%)",
        default: 10
    },
    losslessImages: {
        type: OptionType.BOOLEAN,
        description: "Convert images to lossless WebP (pixel-identical). Turn off for smaller lossy WebP.",
        default: true
    },
    imageQuality: {
        type: OptionType.NUMBER,
        description: "Lossy WebP quality from 0.1 to 1 (only used when lossless is off)",
        default: 0.85
    },
    videoCrf: {
        type: OptionType.NUMBER,
        description: "Video quality (CRF, 14-40). Lower = better quality and bigger file. 20 is near-lossless, 26-28 is much smaller.",
        default: 20
    },
    videoCodec: {
        type: OptionType.SELECT,
        description: "H.265 can make smaller files but is less widely supported and requires ffmpeg with libx265.",
        options: [
            { label: "H.264", value: "h264", default: true },
            { label: "H.265", value: "h265" }
        ]
    },
    videoMaxHeight: {
        type: OptionType.NUMBER,
        description: "Downscale videos taller than this many pixels (never upscales)",
        default: 1080
    },
    videoPreset: {
        type: OptionType.SELECT,
        description: "Encoder speed. Slower presets make smaller files but take longer.",
        options: [
            { label: "veryfast", value: "veryfast" },
            { label: "fast", value: "fast" },
            { label: "medium", value: "medium", default: true },
            { label: "slow", value: "slow" }
        ]
    },
    audioKbps: {
        type: OptionType.NUMBER,
        description: "Audio bitrate in kbps (32-320)",
        default: 128
    },
    ffmpegPath: {
        type: OptionType.STRING,
        description: "Full path to ffmpeg (leave empty to use bundled ffmpeg, then fall back to PATH)",
        default: ""
    },
    notifyOnError: {
        type: OptionType.BOOLEAN,
        description: "Show a toast when video compression fails (for example ffmpeg not found)",
        default: true
    }
});

function minSavedFraction() {
    const pct = Math.min(90, Math.max(0, Number(settings.store.minSavingsPercent) || 0));
    return 1 - pct / 100;
}

async function compressImage(file: File): Promise<File> {
    if (!file.type.startsWith("image/") || file.type === "image/gif") return file;

    const bmp = await createImageBitmap(file);
    const canvas = new OffscreenCanvas(bmp.width, bmp.height);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0);

    const quality = settings.store.losslessImages
        ? 1
        : Math.min(1, Math.max(0.1, Number(settings.store.imageQuality) || 0.85));

    const blob = await canvas.convertToBlob({ type: "image/webp", quality });
    console.log("[CompressUploads] image", file.size, "->", blob.size);
    if (blob.size >= file.size * minSavedFraction()) return file;

    return new File([blob], file.name.replace(/\.\w+$/, ".webp"), { type: "image/webp" });
}

async function compressVideo(file: File): Promise<File> {
    if (!Native) {
        console.log("[CompressUploads] no native helper (not the desktop app?), skipping video");
        return file;
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const res = await Native.compressVideo(bytes, {
        ffmpegPath: settings.store.ffmpegPath,
        crf: Number(settings.store.videoCrf),
        codec: settings.store.videoCodec,
        maxHeight: Number(settings.store.videoMaxHeight),
        preset: settings.store.videoPreset,
        audioKbps: Number(settings.store.audioKbps),
        ext: file.name.match(/\.\w+$/)?.[0] ?? ".mp4"
    });
    console.log("[CompressUploads] video", res.error, res.inSize, "->", res.outSize);

    if (res.error && settings.store.notifyOnError) {
        Toasts.show({
            message: "CompressUploads: video compression failed, sending the original (check ffmpeg)",
            id: Toasts.genId(),
            type: Toasts.Type.FAILURE
        });
    }

    if (!res.data || res.outSize >= res.inSize * minSavedFraction()) return file;

    const buffer = new ArrayBuffer(res.data.byteLength);
    new Uint8Array(buffer).set(res.data);
    return new File([buffer], file.name.replace(/\.\w+$/, ".mp4"), { type: "video/mp4" });
}

export default definePlugin({
    name: "CompressUploads",
    description: "Compresses images and videos before upload",
    tags: ["Utility", "Media"],
    authors: [EquicordDevs.PehCake],
    settings,

    patches: [
        {
            find: 'this.setStatus("STARTED"),this.startTime=performance.now()',
            replacement: {
                match: /async upload\(\)\{if\("COMPLETED"===this\.status\)return;/,
                replace: "$&await $self.processUpload(this);"
            }
        }
    ],

    start() {
        console.log("[CompressUploads] started");
    },

    processUpload(upload: any): Promise<void> {
        upload.__compressUploadsJob ??= (async () => {
            try {
                const file = upload?.item?.file;
                console.log("[CompressUploads] upload()", upload?.filename, file);
                if (!(file instanceof File)) {
                    console.log("[CompressUploads] no File on upload.item, object:", upload);
                    return;
                }

                const minBytes = Math.max(0, Number(settings.store.minSizeKB) || 0) * 1024;
                if (file.size < minBytes) return;

                const isVideo = file.type.startsWith("video/");
                const isImage = file.type.startsWith("image/");
                if (isVideo && !settings.store.enableVideos) return;
                if (isImage && !settings.store.enableImages) return;
                if (!isVideo && !isImage) return;

                const out = isVideo ? await compressVideo(file) : await compressImage(file);
                if (out === file) return;

                upload.item.file = out;
                upload.currentSize = out.size;
                upload.postCompressionSize = out.size;
                try { upload.filename = out.name; } catch { }
                try { upload.mimeType = out.type; } catch { }
                console.log("[CompressUploads] swapped file:", file.size, "->", out.size);
            } catch (e) {
                console.error("[CompressUploads] failed", e);
            }
        })();

        return upload.__compressUploadsJob;
    }
});
