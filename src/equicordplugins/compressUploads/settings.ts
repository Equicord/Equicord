/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export const settings = definePluginSettings({
    enabled: {
        type: OptionType.BOOLEAN,
        displayName: "Enabled",
        description: "Master switch. You can also Shift+click or right-click the chat bar button to toggle it.",
        default: true
    },
    enableImages: {
        type: OptionType.BOOLEAN,
        displayName: "Compress images",
        description: "Convert images to WebP before uploading.",
        default: true
    },
    enableVideos: {
        type: OptionType.BOOLEAN,
        displayName: "Compress videos",
        description: "Needs ffmpeg and only works in the desktop app.",
        target: "DESKTOP",
        default: true
    },
    compressOversized: {
        type: OptionType.BOOLEAN,
        displayName: "Compress oversized uploads",
        description: "Compress files over your upload limit instead of letting Discord reject them.",
        default: true
    },
    minSizeKB: {
        type: OptionType.NUMBER,
        displayName: "Minimum file size (KB)",
        description: "Skip files smaller than this.",
        default: 256
    },
    minSavingsPercent: {
        type: OptionType.NUMBER,
        displayName: "Minimum savings (%)",
        description: "Only use the compressed file if it is at least this much smaller.",
        default: 10
    },
    losslessImages: {
        type: OptionType.BOOLEAN,
        displayName: "Prefer lossless",
        description: "Uses lossless WebP for images instead of lossy. If the Discord minimum file size is not met, it will fall back to lossy.",
        default: false
    },
    imageQuality: {
        type: OptionType.NUMBER,
        displayName: "Lossy quality",
        description: "Between 0.1 and 1. Only used when lossless is off.",
        default: 0.85
    },
    videoCrf: {
        type: OptionType.NUMBER,
        displayName: "Video quality (CRF)",
        description: "Between 14 and 40. Lower means better quality and larger files.",
        target: "DESKTOP",
        default: 20
    },
    h265: {
        type: OptionType.BOOLEAN,
        displayName: "Use H.265",
        description: "Makes smaller files, but needs ffmpeg built with libx265 and is less widely supported.",
        target: "DESKTOP",
        default: false
    },
    videoMaxHeight: {
        type: OptionType.NUMBER,
        displayName: "Max video height (px)",
        description: "Downscale videos taller than this. Never upscales.",
        target: "DESKTOP",
        default: 1080
    },
    videoPreset: {
        type: OptionType.SELECT,
        displayName: "Encoder preset",
        description: "Slower presets make smaller files but take longer.",
        target: "DESKTOP",
        options: [
            { label: "veryfast", value: "veryfast" },
            { label: "fast", value: "fast" },
            { label: "medium", value: "medium", default: true },
            { label: "slow", value: "slow" }
        ]
    },
    audioKbps: {
        type: OptionType.NUMBER,
        displayName: "Audio bitrate (kbps)",
        description: "Between 32 and 320.",
        target: "DESKTOP",
        default: 128
    },
    ffmpegPath: {
        type: OptionType.STRING,
        displayName: "ffmpeg path",
        description: "Absolute path to an ffmpeg binary. Leave empty to use the one on your PATH.",
        target: "DESKTOP",
        default: ""
    },
    notifyOnError: {
        type: OptionType.BOOLEAN,
        displayName: "Show error toasts",
        description: "Show a toast when compression fails, for example when ffmpeg is missing.",
        default: true
    }
});
