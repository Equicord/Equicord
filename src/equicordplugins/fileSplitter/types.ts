/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface ChunkMeta {
    type: "FileSplitterChunk";
    index: number;
    total: number;
    originalName: string;
    originalSize: number;
    timestamp: number;
}

export interface ChunkData extends ChunkMeta {
    url: string;
    channelId: string;
    messageId: string;
}

export interface ChunkEntry {
    chunks: ChunkData[];
    lastUpdated: number;
}

export interface MergedResult {
    key: string;
    originalName: string;
    isImage: boolean;
    mimeType: string;
    status: "pending" | "loading" | "ready" | "error";
    blob?: Blob;
    objectUrl?: string;
    error?: string;
}
