/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { DATA_DIR } from "@main/utils/constants";
import { dialog, IpcMainInvokeEvent, shell } from "electron";

import { getSettings, saveSettings } from "./settings";
export * from "./export";
export * from "./import";

import { LoggedAttachment } from "../types";
import { LOGS_DATA_FILENAME } from "../utils/constants";
import { ensureDirectoryExists, getAttachmentIdFromFilename, sleep } from "./utils";

export { getSettings };

// so we can filter the native helpers by this key
export function messageLoggerEnhancedUniqueIdThingyIdkMan() { }

// Map<attachmetId, path>()
const nativeSavedImages = new Map<string, string>();
export const getNativeSavedImages = () => nativeSavedImages;

let logsDir: string;
let imageCacheDir: string;

const allowedAttachmentHosts = new Set(["cdn.discordapp.com", "media.discordapp.net"]);
const pathSeparators = /[\\/]/;

const getImageCacheDir = async () => imageCacheDir ?? await getDefaultNativeImageDir();
const getLogsDir = async () => logsDir ?? await getDefaultNativeDataDir();

function getPathInsideDir(dir: string, filename: string) {
    const targetPath = path.normalize(path.join(dir, filename));
    const normalizedDir = path.normalize(dir);
    const pathPrefix = normalizedDir.endsWith(path.sep) ? normalizedDir : normalizedDir + path.sep;

    return targetPath.startsWith(pathPrefix) ? targetPath : null;
}

function getSafeAttachmentId(attachmentId: unknown) {
    if (typeof attachmentId !== "string" || !attachmentId || pathSeparators.test(attachmentId) || attachmentId.includes("."))
        return null;

    return attachmentId;
}

function getSafeFilename(filename: unknown) {
    if (typeof filename !== "string" || !filename || pathSeparators.test(filename))
        return null;

    return filename;
}

function getSafeFileExtension(fileExtension: unknown) {
    if (typeof fileExtension !== "string" || !fileExtension)
        return null;

    const normalizedExtension = fileExtension.startsWith(".") ? fileExtension : `.${fileExtension}`;
    return /^\.[a-zA-Z0-9]+$/.test(normalizedExtension) ? normalizedExtension : null;
}

function getSafeAttachmentUrl(url: unknown) {
    if (typeof url !== "string")
        return null;

    try {
        const parsedUrl = new URL(url);

        if (parsedUrl.protocol !== "https:" || !allowedAttachmentHosts.has(parsedUrl.hostname))
            return null;

        if (!parsedUrl.pathname.startsWith("/attachments/") && !parsedUrl.pathname.startsWith("/ephemeral-attachments/"))
            return null;

        return parsedUrl.toString();
    } catch {
        return null;
    }
}

export async function initDirs() {
    const { logsDir: ld, imageCacheDir: icd } = await getSettings();

    logsDir = ld || await getDefaultNativeDataDir();
    imageCacheDir = icd || await getDefaultNativeImageDir();
}
initDirs();

export async function init(_event: IpcMainInvokeEvent) {
    const imageDir = await getImageCacheDir();

    await ensureDirectoryExists(imageDir);
    const files = await readdir(imageDir);
    for (const filename of files) {
        const attachmentId = getAttachmentIdFromFilename(filename);
        nativeSavedImages.set(attachmentId, path.join(imageDir, filename));
    }
}

export async function getImageNative(_event: IpcMainInvokeEvent, attachmentId: string): Promise<Uint8Array | Buffer | null> {
    const safeAttachmentId = getSafeAttachmentId(attachmentId);
    if (!safeAttachmentId) return null;

    const imagePath = nativeSavedImages.get(safeAttachmentId);
    if (!imagePath) return null;

    try {
        return await readFile(imagePath);
    } catch (error: any) {
        console.error(error);
        return null;
    }
}

export async function writeImageNative(_event: IpcMainInvokeEvent, filename: string, content: Uint8Array) {
    const safeFilename = getSafeFilename(filename);
    if (!safeFilename || !content) return;
    const imageDir = await getImageCacheDir();

    // returns the file name
    // ../../someMalicousPath.png -> someMalicousPath
    const attachmentId = getSafeAttachmentId(getAttachmentIdFromFilename(safeFilename));
    if (!attachmentId) return;

    const existingImage = nativeSavedImages.get(attachmentId);
    if (existingImage) return;

    const imagePath = getPathInsideDir(imageDir, safeFilename);
    if (!imagePath) return;
    await ensureDirectoryExists(imageDir);
    await writeFile(imagePath, content);

    nativeSavedImages.set(attachmentId, imagePath);
}

export async function deleteFileNative(_event: IpcMainInvokeEvent, attachmentId: string) {
    const safeAttachmentId = getSafeAttachmentId(attachmentId);
    if (!safeAttachmentId) return;

    const imagePath = nativeSavedImages.get(safeAttachmentId);
    if (!imagePath) return;

    await unlink(imagePath);
    nativeSavedImages.delete(safeAttachmentId);
}

export async function writeLogs(_event: IpcMainInvokeEvent, contents: string) {
    if (typeof contents !== "string") return;
    const logsDir = await getLogsDir();

    await ensureDirectoryExists(logsDir);
    await writeFile(path.join(logsDir, LOGS_DATA_FILENAME), contents);
}

export async function getDefaultNativeImageDir(): Promise<string> {
    return path.join(await getDefaultNativeDataDir(), "savedImages");
}

export async function getDefaultNativeDataDir(): Promise<string> {
    return path.join(DATA_DIR, "MessageLoggerData");
}

export async function chooseDir(event: IpcMainInvokeEvent, logKey: "logsDir" | "imageCacheDir") {
        if (logKey !== "logsDir" && logKey !== "imageCacheDir")
        return "";

    const settings = await getSettings();
    const defaultPath = settings[logKey] || await getDefaultNativeDataDir();

    const res = await dialog.showOpenDialog({ properties: ["openDirectory"], defaultPath: defaultPath });
    const dir = res.filePaths[0];

    if (!dir) throw Error("Invalid Directory");

    settings[logKey] = dir;

    await saveSettings(settings);

    switch (logKey) {
        case "logsDir": logsDir = dir; break;
        case "imageCacheDir": imageCacheDir = dir; break;
    }

    if (logKey === "imageCacheDir")
        await init(event);

    return dir;
}

export async function showItemInFolder(_event: IpcMainInvokeEvent) {
    shell.showItemInFolder(await getImageCacheDir());
}

export async function chooseFile(_event: IpcMainInvokeEvent, title: string, filters: Electron.FileFilter[], defaultPath?: string) {
    const res = await dialog.showOpenDialog({ title, filters, properties: ["openFile"], defaultPath });
    const [path] = res.filePaths;

    if (!path) throw Error("Invalid file");

    return await readFile(path, "utf-8");
}

// doing it in native because you can only fetch images from the renderer
// other types of files will cause cors issues
export async function downloadAttachment(_event: IpcMainInvokeEvent, attachment: LoggedAttachment, attempts = 0, useOldUrl = false): Promise<{ error: string | null; path: string | null; }> {
    try {
        const attachmentId = getSafeAttachmentId(attachment?.id);
        const fileExtension = getSafeFileExtension(attachment?.fileExtension);
        const attachmentUrl = getSafeAttachmentUrl(useOldUrl ? attachment?.oldUrl : attachment?.url);

        if (!attachmentId || !fileExtension || !attachmentUrl)
            return { error: "Invalid Attachment", path: null };

        const existingImage = nativeSavedImages.get(attachmentId);
        if (existingImage)
            return {
                error: null,
                path: existingImage
            };

        const res = await fetch(attachmentUrl);

        if (res.status !== 200) {
            if (res.status === 404 || res.status === 403 || res.status === 415)
                useOldUrl = true;

            attempts++;
            if (attempts > 3) {
                return {
                    error: `Failed to get attachment ${attachmentId} for caching. too many attempts, error code ${res.status}`,
                    path: null,
                };
            }

            await sleep(1000);
            return downloadAttachment(_event, attachment, attempts, useOldUrl);
        }

        const ab = await res.arrayBuffer();
        const imageCacheDir = await getImageCacheDir();
        await ensureDirectoryExists(imageCacheDir);

        const finalPath = getPathInsideDir(imageCacheDir, `${attachmentId}${fileExtension}`);
        if (!finalPath)
            return { error: "Invalid Attachment", path: null };
        await writeFile(finalPath, Buffer.from(ab));

        nativeSavedImages.set(attachmentId, finalPath);

        return {
            error: null,
            path: finalPath
        };

    } catch (error: any) {
        console.error(error);
        return { error: error.message, path: null };
    }
}
