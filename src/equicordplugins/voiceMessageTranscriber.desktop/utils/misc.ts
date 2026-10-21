/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { classNameFactory } from "@utils/css";

import type { TranscriptionResult } from "./worker";

export const cl = classNameFactory("vc-transcription-");

export function formatTimestamp(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function formatTranscript(result: TranscriptionResult | null, showTimestamps: boolean) {
    if (!result) return "";
    return showTimestamps
        ? result.chunks.map(c => `[${formatTimestamp(c.timestamp[0])} - ${formatTimestamp(c.timestamp[1])}] ${c.text}`).join("\n")
        : result.text;
}
