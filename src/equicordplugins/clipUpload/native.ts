/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { dialog, type IpcMainInvokeEvent } from "electron";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { basename, extname, join, normalize } from "path";

const selectedFiles = new Set<string>();

const mimeTypes: Record<string, string> = {
    ".mp4": "video/mp4",
    ".m4v": "video/mp4",
};

function getMimeType(path: string) {
    return mimeTypes[extname(path).toLowerCase()] ?? null;
}

export async function chooseVideoFile(_event: IpcMainInvokeEvent) {
    try {
        // chooseFile cannot expose the native path needed by updateClipMetadata.
        const { filePaths } = await dialog.showOpenDialog({
            title: "Select clip file",
            filters: [
                { name: "MP4 Video", extensions: ["mp4", "m4v"] }
            ],
            properties: ["openFile"]
        });

        const [rawPath] = filePaths;
        if (!rawPath) return null;

        const path = normalize(rawPath);
        const type = getMimeType(path);
        if (!type) return null;

        selectedFiles.add(path);

        return {
            path,
            name: basename(path),
            type
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

export async function createTempVideoFile(_event: IpcMainInvokeEvent, rawPath: string) {
    if (typeof rawPath !== "string") return null;

    const path = normalize(rawPath);
    if (!selectedFiles.has(path)) return null;

    try {
        const tmpDir = await mkdtemp(join(tmpdir(), "equicord-clip-upload-"));
        const tmpPath = join(tmpDir, basename(path));
        await writeFile(tmpPath, await readFile(path));
        selectedFiles.add(tmpPath);
        return tmpPath;
    } catch {
        return null;
    }
}

export async function deleteTempVideoFile(_event: IpcMainInvokeEvent, rawPath: string) {
    if (typeof rawPath !== "string") return;

    const path = normalize(rawPath);
    if (!selectedFiles.delete(path)) return;

    await rm(path, { force: true });
    await rm(join(path, ".."), { force: true, recursive: true });
}
