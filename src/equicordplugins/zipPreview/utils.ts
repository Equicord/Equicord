/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { PluginNative } from "@utils/types";
import { saveFile } from "@utils/web";
import { unzipSync } from "fflate";

const Native = VencordNative?.pluginHelpers?.ZipPreview as PluginNative<typeof import("./native")> | undefined;

export const MAX_ZIP_BYTES = 50 * 1024 * 1024;
export const MAX_ENTRIES = 1000;
export const MAX_PREVIEW_BYTES = 10 * 1024 * 1024;

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "avif", "bmp"]);
const TEXT_EXTENSIONS = new Set([
    "c",
    "cpp",
    "cs",
    "css",
    "csv",
    "go",
    "h",
    "html",
    "java",
    "js",
    "json",
    "jsx",
    "log",
    "lua",
    "md",
    "php",
    "py",
    "rs",
    "scss",
    "sh",
    "svg",
    "toml",
    "ts",
    "tsx",
    "txt",
    "xml",
    "yaml",
    "yml"
]);

export type ZipPreviewKind = "image" | "text" | "unsupported";

export interface ZipEntry {
    path: string;
    name: string;
    size: number;
    data: Uint8Array;
    kind: ZipPreviewKind;
    extension: string;
}

export interface ZipDirectoryEntry {
    path: string;
    name: string;
    depth: number;
    type: "directory";
}

export interface ZipFileEntry extends ZipEntry {
    depth: number;
    type: "file";
}

export type ZipTreeEntry = ZipDirectoryEntry | ZipFileEntry;

export interface ZipPreviewResult {
    entries: ZipEntry[];
    treeEntries: ZipTreeEntry[];
    truncated: boolean;
}

export type ZipPreviewCacheState =
    | { status: "pending"; promise: Promise<ZipPreviewResult>; }
    | { status: "resolved"; result: ZipPreviewResult; }
    | { status: "rejected"; message: string; };

const zipCache = new Map<string, ZipPreviewCacheState>();

export function isZipFile(fileName?: string): boolean {
    return typeof fileName === "string" && /\.zip$/i.test(fileName);
}

export function getAttachmentFileName(props: ZipPreviewAttachmentProps): string | undefined {
    return props.fileName ?? props.item?.originalItem?.filename ?? props.item?.originalItem?.title;
}

export function getAttachmentUrl(props: ZipPreviewAttachmentProps): string | undefined {
    return props.url ?? props.item?.downloadUrl ?? props.item?.originalItem?.url ?? props.item?.originalItem?.proxy_url;
}

export function getCachedZip(url: string): ZipPreviewCacheState {
    const cached = zipCache.get(url);
    if (cached) return cached;

    const promise = loadZip(url)
        .then(result => {
            zipCache.set(url, { status: "resolved", result });
            return result;
        })
        .catch(error => {
            const message = error instanceof Error ? error.message : "Failed to preview ZIP.";
            zipCache.set(url, { status: "rejected", message });
            throw error;
        });

    const pending = { status: "pending" as const, promise };
    zipCache.set(url, pending);
    return pending;
}

export function clearZipPreviewCache() {
    zipCache.clear();
}

export function makeDownload(entry: ZipEntry) {
    const type = entry.kind === "image" ? getImageMimeType(entry.extension) : "text/plain;charset=utf-8";
    saveFile(new File([entry.data as BlobPart], entry.name, { type }));
}

export function createImageObjectUrl(entry: ZipEntry): string {
    return URL.createObjectURL(new Blob([entry.data as BlobPart], { type: getImageMimeType(entry.extension) }));
}

export function readTextEntry(entry: ZipEntry): string {
    return new TextDecoder("utf-8").decode(entry.data);
}

export function getCodeLanguage(entry: ZipEntry): string {
    const languageMap: Record<string, string> = {
        js: "javascript",
        jsx: "jsx",
        md: "markdown",
        py: "python",
        rs: "rust",
        sh: "bash",
        ts: "typescript",
        tsx: "tsx",
        yml: "yaml"
    };

    return languageMap[entry.extension] ?? entry.extension;
}

async function loadZip(url: string): Promise<ZipPreviewResult> {
    if (Native) {
        const nativeResult = await Native.fetchFile(url);
        if (nativeResult.success && nativeResult.data) {
            if (nativeResult.data.byteLength > MAX_ZIP_BYTES) throw new Error("ZIP is too large to preview.");
            return parseZipBuffer(nativeResult.data);
        }
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error("Could not fetch ZIP.");

    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_ZIP_BYTES) {
        throw new Error("ZIP is too large to preview.");
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_ZIP_BYTES) throw new Error("ZIP is too large to preview.");

    return parseZipBuffer(buffer);
}

function parseZipBuffer(buffer: ArrayBuffer): ZipPreviewResult {
    const unzipped = unzipSync(new Uint8Array(buffer));
    const files = Object.entries(unzipped)
        .filter(([path]) => !path.endsWith("/"))
        .sort(([a], [b]) => a.localeCompare(b));

    const truncated = files.length > MAX_ENTRIES;
    const entries = files.slice(0, MAX_ENTRIES).map(([path, data]) => {
        const normalizedPath = normalizePath(path);
        const extension = getExtension(normalizedPath);

        return {
            path: normalizedPath,
            name: getFileName(normalizedPath),
            size: data.byteLength,
            data,
            extension,
            kind: getPreviewKind(extension, data.byteLength)
        };
    });

    return {
        entries,
        treeEntries: buildTreeEntries(entries, truncated),
        truncated
    };
}

function buildTreeEntries(entries: ZipEntry[], truncated: boolean): ZipTreeEntry[] {
    const directories = new Set<string>();

    for (const entry of entries) {
        const parts = entry.path.split("/");
        for (let index = 1; index < parts.length; index++) {
            directories.add(parts.slice(0, index).join("/"));
        }
    }

    const directoryEntries = Array.from(directories, path => ({
        path,
        name: `${getFileName(path)}/`,
        depth: path.split("/").length - 1,
        type: "directory" as const
    }));

    const fileEntries = entries.map(entry => ({
        ...entry,
        depth: entry.path.split("/").length - 1,
        type: "file" as const
    }));

    const treeEntries: ZipTreeEntry[] = [...directoryEntries, ...fileEntries]
        .sort((a, b) => a.path.localeCompare(b.path));

    if (truncated) {
        treeEntries.push({
            path: "__zip_preview_truncated__",
            name: `Only showing first ${MAX_ENTRIES} entries`,
            depth: 0,
            type: "directory"
        });
    }

    return treeEntries;
}

function getPreviewKind(extension: string, size: number): ZipPreviewKind {
    if (size > MAX_PREVIEW_BYTES) return "unsupported";
    if (IMAGE_EXTENSIONS.has(extension)) return "image";
    if (TEXT_EXTENSIONS.has(extension)) return "text";
    return "unsupported";
}

function getImageMimeType(extension: string): string {
    if (extension === "jpg") return "image/jpeg";
    return `image/${extension}`;
}

function normalizePath(path: string): string {
    return path.replace(/^\/+/, "").replaceAll("\\", "/");
}

function getFileName(path: string): string {
    return path.split("/").at(-1) || path;
}

function getExtension(path: string): string {
    const fileName = getFileName(path);
    const dotIndex = fileName.lastIndexOf(".");
    return dotIndex === -1 ? "" : fileName.slice(dotIndex + 1).toLowerCase();
}

export interface ZipPreviewAttachmentProps {
    fileName?: string;
    fileSize?: number;
    url?: string;
    item?: {
        downloadUrl?: string;
        originalItem?: {
            filename?: string;
            proxy_url?: string;
            size?: number;
            title?: string;
            url?: string;
        };
    };
}
