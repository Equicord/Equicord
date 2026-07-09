/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export type SplitMode = "characters" | "spaces" | "newlines";

function findSplitIndex(content: string, limit: number, mode: SplitMode): number {
    if (mode === "characters") return limit;

    const boundary = mode === "newlines" ? "\n" : " ";
    const preferredBoundary = content.lastIndexOf(boundary, limit - 1);

    if (preferredBoundary > 0) return preferredBoundary + boundary.length;
    if (mode === "newlines") {
        const spaceBoundary = content.lastIndexOf(" ", limit - 1);
        if (spaceBoundary > 0) return spaceBoundary + 1;
    }

    return limit;
}

 // each returned chunk is at most `limit` UTF-16 code units, matching discord's limit.
export function splitMessage(content: string, limit: number, mode: SplitMode): string[] {
    if (limit < 1) return [];

    const chunks: string[] = [];
    let remaining = content;

    while (remaining.length > limit) {
        const splitIndex = findSplitIndex(remaining, limit, mode);
        chunks.push(remaining.slice(0, splitIndex));
        remaining = remaining.slice(splitIndex);
    }

    if (remaining) chunks.push(remaining);
    return chunks;
}
