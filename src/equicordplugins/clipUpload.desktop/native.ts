/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ensureSafePath } from "@main/ipcMain";
import { DATA_DIR } from "@main/utils/constants";
import { randomUUID } from "crypto";
import { dialog, type IpcMainInvokeEvent } from "electron";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import { basename, extname, join, resolve } from "path";

interface TempEntry {
    tmpDir: string;
    tmpPath: string;
}

const pendingTokens = new Map<string, string>();
const tempEntries = new Map<string, TempEntry>();
const CLIP_UPLOAD_DIR = join(DATA_DIR, "clipUpload");
const ALLOWED_EXTENSIONS = new Set([".mp4", ".m4v"]);
const MIME_TYPES: Record<string, string> = {
    ".mp4": "video/mp4",
    ".m4v": "video/mp4",
};

function getMimeType(filePath: string): string {
    return MIME_TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

export async function chooseVideoFile(_: IpcMainInvokeEvent): Promise<{ token: string; name: string; type: string; } | null> {
    try {
        const { filePaths, canceled } = await dialog.showOpenDialog({
            title: "Select clip file",
            filters: [{ name: "MP4 Video", extensions: ["mp4", "m4v"] }],
            properties: ["openFile"],
        });

        if (canceled || filePaths.length === 0) return null;

        const resolvedPath = resolve(filePaths[0]);
        if (!ALLOWED_EXTENSIONS.has(extname(resolvedPath).toLowerCase())) return null;

        const token = randomUUID();
        pendingTokens.set(token, resolvedPath);

        return { token, name: basename(resolvedPath), type: getMimeType(resolvedPath) };
    } catch {
        return null;
    }
}

export async function createTempVideoFile(_: IpcMainInvokeEvent, token: string): Promise<string | null> {
    const originalPath = pendingTokens.get(token);
    if (!originalPath) return null;
    pendingTokens.delete(token);

    try {
        const tmpDir = join(CLIP_UPLOAD_DIR, randomUUID());
        const tmpPath = join(tmpDir, basename(originalPath));

        if (!ensureSafePath(tmpDir, basename(originalPath))) return null;

        await mkdir(tmpDir, { recursive: true });
        await writeFile(tmpPath, await readFile(originalPath));

        const tmpToken = randomUUID();
        tempEntries.set(tmpToken, { tmpDir, tmpPath });
        return tmpToken;
    } catch {
        return null;
    }
}

export async function readVideoFile(_: IpcMainInvokeEvent, token: string): Promise<Uint8Array | null> {
    const entry = tempEntries.get(token);
    if (!entry) return null;

    try {
        const buf = await readFile(entry.tmpPath);
        return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    } catch {
        return null;
    }
}

export async function deleteTempVideoFile(_: IpcMainInvokeEvent, token: string): Promise<void> {
    const entry = tempEntries.get(token);
    if (!entry) return;

    tempEntries.delete(token);

    if (!ensureSafePath(CLIP_UPLOAD_DIR, entry.tmpDir)) return;

    try {
        await rm(entry.tmpDir, { force: true, recursive: true });
    } catch { }
}
