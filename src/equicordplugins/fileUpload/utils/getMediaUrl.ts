/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const imageExtensions = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "tiff", "avif", "svg"];
const videoExtensions = ["mp4", "webm", "ogg", "avi", "wmv", "flv", "mov", "mkv", "m4v"];
const supportedExtensions = [...imageExtensions, ...videoExtensions];

const mimeToExtension: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/bmp": "bmp",
    "image/x-icon": "ico",
    "image/tiff": "tiff",
    "image/avif": "avif",
    "image/svg+xml": "svg",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/ogg": "ogg",
    "video/x-msvideo": "avi",
    "video/x-ms-wmv": "wmv",
    "video/x-flv": "flv",
    "video/quicktime": "mov",
    "video/x-matroska": "mkv"
};

export function getExtensionFromMime(mimeType: string): string | undefined {
    const baseMime = mimeType.split(";")[0].trim().toLowerCase();
    return mimeToExtension[baseMime];
}

const extensionToMime: Record<string, string> = {
    "png": "image/png",
    "apng": "image/apng",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "gif": "image/gif",
    "webp": "image/webp",
    "bmp": "image/bmp",
    "ico": "image/x-icon",
    "tiff": "image/tiff",
    "avif": "image/avif",
    "svg": "image/svg+xml",
    "mp4": "video/mp4",
    "webm": "video/webm",
    "ogg": "video/ogg",
    "avi": "video/x-msvideo",
    "wmv": "video/x-ms-wmv",
    "flv": "video/x-flv",
    "mov": "video/quicktime",
    "mkv": "video/x-matroska"
};

export function getMimeFromExtension(ext: string): string {
    return extensionToMime[ext.toLowerCase()] || "application/octet-stream";
}

export async function getExtensionFromBytes(blob: Blob): Promise<string | undefined> {
    const buffer = await blob.slice(0, 12).arrayBuffer();
    const bytes = new Uint8Array(buffer);

    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
        return "gif";
    }

    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
        const fullBuffer = await blob.slice(0, 4096).arrayBuffer();
        const fullBytes = new Uint8Array(fullBuffer);
        for (let i = 0; i < fullBytes.length - 4; i++) {
            if (fullBytes[i] === 0x61 && fullBytes[i + 1] === 0x63 &&
                fullBytes[i + 2] === 0x54 && fullBytes[i + 3] === 0x4C) {
                return "apng";
            }
        }
        return "png";
    }

    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
        bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
        return "webp";
    }

    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
        return "jpg";
    }

    return undefined;
}

export function getUrlExtension(url: string): string | undefined {
    if (!url.startsWith("https:") && !url.startsWith("http:")) {
        url = "https:" + url;
    }
    try {
        let { pathname } = new URL(url);
        pathname = pathname.replace(/\/+$/, "");
        const lastSegment = pathname.split("/").pop() || "";
        if (!lastSegment.includes(".")) return undefined;
        const ext = lastSegment.split(".").pop()?.toLowerCase();
        if (!ext || ext.length === 0 || ext.length > 10) return undefined;
        return ext;
    } catch {
        return undefined;
    }
}

export function isSupported(url: string): boolean {
    const ext = getUrlExtension(url);
    return ext ? supportedExtensions.includes(ext) : false;
}

export function getMediaUrl(props: { src?: string; href?: string; itemSrc?: string; itemHref?: string; target?: any }): string | null {
    const url = props.src || props.href || props.itemSrc || props.itemHref;
    if (url && isSupported(url)) return url;

    if (props.target?.closest) {
        const img = props.target.closest("img") || props.target.querySelector?.("img");
        const video = props.target.closest("video") || props.target.querySelector?.("video");
        const src = img?.src || video?.src;
        if (src && isSupported(src)) return src;
    }

    return null;
}
