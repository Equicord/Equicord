/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { dialog, type IpcMainInvokeEvent } from "electron";
import { readFile } from "fs/promises";
import { basename, extname, normalize } from "path";

const selectedFiles = new Set<string>();

const mimeTypes: Record<string, string> = {
    ".mp4": "video/mp4",
    ".m4v": "video/mp4",
    ".mov": "video/quicktime",
    ".webm": "video/webm",
};

function getMimeType(path: string) {
    return mimeTypes[extname(path).toLowerCase()] ?? "video/mp4";
}

export async function chooseVideoFile(_event: IpcMainInvokeEvent) {
    try {
        // chooseFile cannot expose the native path needed by updateClipMetadata.
        const { filePaths } = await dialog.showOpenDialog({
            title: "Select clip file",
            filters: [
                { name: "Video", extensions: ["mp4", "m4v"] },
                { name: "All Files", extensions: ["*"] }
            ],
            properties: ["openFile"]
        });

        const [rawPath] = filePaths;
        if (!rawPath) return null;

        const path = normalize(rawPath);
        selectedFiles.add(path);

        return {
            path,
            name: basename(path),
            type: getMimeType(path)
        };
    } catch {
        return null;
    }
}

export async function readVideoFile(_event: IpcMainInvokeEvent, rawPath: string) {
    if (typeof rawPath !== "string") return null;

    const path = normalize(rawPath);
    if (!selectedFiles.has(path)) return null;

    try {
        const buf = await readFile(path);
        return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    } catch {
        return null;
    } finally {
        selectedFiles.delete(path);
    }
}
