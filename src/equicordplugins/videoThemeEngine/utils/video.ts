/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DataStore } from "@api/index";
import { Logger } from "@utils/Logger";
import { chooseFile } from "@utils/web";
import { Toasts } from "@webpack/common";

import { settings } from "../settings";
import { VIDEO_STORE_KEY } from "./constants";

const logger = new Logger("VideoThemeEngine");

interface StoredVideo {
    data: Uint8Array | number[];
    name: string;
    mime: string;
}

let activeObjectUrl: string | null = null;
let activeBlobKey: string | null = null;

function storedVideoKey(stored: StoredVideo, byteLength: number): string {
    return `${stored.name}:${byteLength}:${stored.mime}`;
}

export function bumpVideoReloadToken(): void {
    settings.store.videoReloadToken = (settings.store.videoReloadToken ?? 0) + 1;
}

export function basename(path: string): string {
    return path.split(/[/\\]/).pop() || path;
}

function getEquicordDataDir(): string {
    if (IS_DISCORD_DESKTOP) {
        try {
            const userData = DiscordNative.app.getPath("userData");
            const sep = userData.includes("\\") ? "\\" : "/";
            const parts = userData.split(/[/\\]/);
            parts.pop();
            return parts.join(sep) + sep + "Equicord";
        } catch (e) {
            logger.warn("Could not resolve Equicord data directory.", e);
        }
    }
    return "";
}

function getDefaultVideoPaths(): string[] {
    const dir = getEquicordDataDir();
    if (!dir) return [];
    const sep = dir.includes("\\") ? "\\" : "/";
    return [`${dir}${sep}background-video.mp4`];
}

function isAbsolutePath(path: string): boolean {
    return /^[a-zA-Z]:[\\/]/.test(path) || path.startsWith("/");
}

function getMimeType(filename: string): string {
    const ext = filename.split(".").pop()?.toLowerCase();
    switch (ext) {
        case "webm": return "video/webm";
        case "ogg": return "video/ogg";
        case "mov": return "video/quicktime";
        default: return "video/mp4";
    }
}

function toFileUrl(path: string): string {
    if (/^https?:\/\//i.test(path) || path.startsWith("file://") || path.startsWith("blob:")) {
        return path;
    }
    return `file:///${path.replace(/\\/g, "/")}`;
}

function resolvePaths(path: string): string[] {
    const out = new Set<string>(getDefaultVideoPaths());
    if (path.trim()) {
        if (isAbsolutePath(path)) out.add(path.trim());
        else {
            const dir = getEquicordDataDir();
            if (dir) {
                const sep = dir.includes("\\") ? "\\" : "/";
                out.add(`${dir}${sep}${path.trim()}`);
            }
            for (const p of getDefaultVideoPaths()) out.add(p);
        }
    }
    return [...out];
}

export function revokeActiveObjectUrl(): void {
    if (activeObjectUrl) {
        URL.revokeObjectURL(activeObjectUrl);
        activeObjectUrl = null;
        activeBlobKey = null;
    }
}

export async function loadStoredVideo(): Promise<string | null> {
    const stored = await DataStore.get<StoredVideo>(VIDEO_STORE_KEY);
    if (!stored?.data) return null;
    const bytes = stored.data instanceof Uint8Array ? stored.data : new Uint8Array(stored.data as number[]);
    if (!bytes.length) return null;

    const key = storedVideoKey(stored, bytes.length);
    if (activeObjectUrl && activeBlobKey === key) return activeObjectUrl;

    revokeActiveObjectUrl();
    activeBlobKey = key;
    activeObjectUrl = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: stored.mime || "video/mp4" }));
    return activeObjectUrl;
}

async function saveVideoData(data: Uint8Array, name: string): Promise<void> {
    revokeActiveObjectUrl();
    await DataStore.set(VIDEO_STORE_KEY, { data: Array.from(data), name, mime: getMimeType(name) });
    settings.store.localVideoPath = name;
    bumpVideoReloadToken();
}

async function readFileArrayBuffer(path: string): Promise<Uint8Array | null> {
    for (const src of [path, toFileUrl(path)]) {
        try {
            const response = await fetch(src);
            if (response.ok) {
                const buffer = new Uint8Array(await response.arrayBuffer());
                if (buffer.length) return buffer;
            }
        } catch {
            continue;
        }
    }
    return new Promise(resolve => {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", toFileUrl(path), true);
        xhr.responseType = "arraybuffer";
        xhr.onload = () => resolve(xhr.status === 200 || xhr.status === 0 ? new Uint8Array(xhr.response) : null);
        xhr.onerror = () => resolve(null);
        xhr.send();
    });
}

async function importVideoFromPath(path: string): Promise<boolean> {
    const buffer = await readFileArrayBuffer(path);
    if (!buffer?.length) return false;
    await saveVideoData(buffer, basename(path));
    return true;
}

async function ensureVideoStored(): Promise<void> {
    const existing = await DataStore.get<StoredVideo>(VIDEO_STORE_KEY);
    if (existing?.data && (existing.data instanceof Uint8Array ? existing.data.length : existing.data.length)) return;
    for (const candidate of resolvePaths(settings.store.localVideoPath)) {
        if (await importVideoFromPath(candidate)) return;
    }
}

export async function getVideoSource(): Promise<string | null> {
    await ensureVideoStored();
    const storedUrl = await loadStoredVideo();
    if (storedUrl) return storedUrl;
    for (const candidate of resolvePaths(settings.store.localVideoPath)) {
        if (isAbsolutePath(candidate)) return candidate;
    }
    return null;
}

export async function pickLocalVideo(): Promise<void> {
    if (IS_DISCORD_DESKTOP) {
        try {
            const [file] = await DiscordNative.fileManager.openFiles({
                filters: [
                    { name: "Video files", extensions: ["mp4", "webm", "ogg", "mov", "mkv"] },
                    { name: "All files", extensions: ["*"] },
                ],
            });
            if (file?.data?.length) {
                const name = (file as { name?: string; filename?: string; }).name
                    ?? (file as { filename?: string; }).filename ?? "background-video.mp4";
                await saveVideoData(file.data, name);
                Toasts.show({
                    message: `Saved video: ${basename(name)}`,
                    type: Toasts.Type.SUCCESS,
                    id: Toasts.genId(),
                });
                return;
            }
        } catch (e) {
            logger.error("Desktop file picker failed.", e);
        }
    }
    const file = await chooseFile("video/mp4,video/webm,.mp4,.webm,.mov");
    if (!file) return;
    await saveVideoData(new Uint8Array(await file.arrayBuffer()), file.name || "video.mp4");
    Toasts.show({
        message: `Saved video: ${basename(file.name || "video.mp4")}`,
        type: Toasts.Type.SUCCESS,
        id: Toasts.genId(),
    });
}
