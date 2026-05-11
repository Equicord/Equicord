/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { clear, createStore, del, entries, get, set } from "@api/DataStore";

export type MediaKind = "image" | "video";

interface StoredMediaRecord {
    blob: Blob;
    width: number;
    height: number;
    kind?: MediaKind;
    selected?: boolean;
    hash?: string;
}

export interface MediaItem {
    id: string;
    blob: Blob;
    src: string;
    width: number;
    height: number;
    kind: MediaKind;
    hash: string;
}

interface NormalizedStoredMediaRecord extends StoredMediaRecord {
    kind: MediaKind;
    hash: string;
}

interface NormalizedMediaEntry {
    id: string;
    item: MediaItem;
    record: NormalizedStoredMediaRecord;
}

const dataStore = createStore("BackgroundManager", "ImageStore");
const ACTIVE_MEDIA_ID_KEY = "BackgroundManager:activeMediaId";

let loaded = false;
let loadPromise: Promise<MediaItem[]> | null = null;
let mediaItems: MediaItem[] = [];
let legacySelectedMediaId = "";

const listeners = new Set<() => void>();

function notify() {
    listeners.forEach(listener => listener());
}

function inferMediaKind(blob: Blob): MediaKind | null {
    if (blob.type.startsWith("image/")) return "image";
    if (blob.type.startsWith("video/")) return "video";
    return null;
}

function bytesToHex(bytes: Uint8Array) {
    return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

async function hashBlob(blob: Blob) {
    const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
    return bytesToHex(new Uint8Array(digest));
}

function createMediaId() {
    return typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function releaseMediaUrls() {
    for (const media of mediaItems) {
        URL.revokeObjectURL(media.src);
    }
}

function toStoredMediaRecord(media: MediaItem): StoredMediaRecord {
    return {
        blob: media.blob,
        width: media.width,
        height: media.height,
        kind: media.kind,
        hash: media.hash
    };
}

function sortEntries(left: [unknown, StoredMediaRecord], right: [unknown, StoredMediaRecord]) {
    return String(left[0]).localeCompare(String(right[0]), undefined, { numeric: true });
}

async function probeImage(blob: Blob) {
    const src = URL.createObjectURL(blob);

    return await new Promise<Omit<MediaItem, "id" | "hash"> | null>(resolve => {
        const image = new Image();

        const cleanup = () => {
            image.onload = null;
            image.onerror = null;
        };

        image.onload = () => {
            cleanup();
            resolve({
                blob,
                src,
                width: image.naturalWidth,
                height: image.naturalHeight,
                kind: "image"
            });
        };

        image.onerror = () => {
            cleanup();
            URL.revokeObjectURL(src);
            resolve(null);
        };

        image.src = src;
    });
}

async function probeVideo(blob: Blob) {
    const src = URL.createObjectURL(blob);

    return await new Promise<Omit<MediaItem, "id" | "hash"> | null>(resolve => {
        const video = document.createElement("video");

        const cleanup = () => {
            video.onloadedmetadata = null;
            video.onerror = null;
            video.removeAttribute("src");
            video.load();
        };

        video.preload = "metadata";
        video.onloadedmetadata = () => {
            const width = video.videoWidth;
            const height = video.videoHeight;
            cleanup();

            resolve({
                blob,
                src,
                width,
                height,
                kind: "video"
            });
        };

        video.onerror = () => {
            cleanup();
            URL.revokeObjectURL(src);
            resolve(null);
        };

        video.src = src;
    });
}

async function probeMedia(blob: Blob) {
    const kind = inferMediaKind(blob);
    if (!kind) return null;

    return kind === "image"
        ? await probeImage(blob)
        : await probeVideo(blob);
}

async function normalizeStoredMedia(rawId: unknown, record: StoredMediaRecord): Promise<NormalizedMediaEntry | null> {
    if (!(record.blob instanceof Blob)) return null;

    const kind = record.kind ?? inferMediaKind(record.blob);
    if (!kind) return null;

    const normalizedRecord: NormalizedStoredMediaRecord = {
        blob: record.blob,
        width: Number(record.width) || 0,
        height: Number(record.height) || 0,
        kind,
        hash: record.hash ?? await hashBlob(record.blob)
    };

    return {
        id: String(rawId),
        item: {
            id: String(rawId),
            blob: normalizedRecord.blob,
            src: URL.createObjectURL(normalizedRecord.blob),
            width: normalizedRecord.width,
            height: normalizedRecord.height,
            kind,
            hash: normalizedRecord.hash
        },
        record: normalizedRecord
    };
}

async function loadMediaItems() {
    const storedEntries = await entries<string, StoredMediaRecord>(dataStore);

    releaseMediaUrls();
    legacySelectedMediaId = "";
    const normalizedEntries: NormalizedMediaEntry[] = [];
    const seenHashes = new Map<string, NormalizedMediaEntry>();
    const removedIds: string[] = [];
    let changed = false;

    for (const [rawId, record] of storedEntries.sort(sortEntries)) {
        const normalized = await normalizeStoredMedia(rawId, record);
        const id = String(rawId);

        if (!normalized) {
            removedIds.push(id);
            changed = true;
            continue;
        }

        if (!legacySelectedMediaId && record.selected) {
            legacySelectedMediaId = id;
        }

        const existing = seenHashes.get(normalized.item.hash);
        if (existing) {
            URL.revokeObjectURL(normalized.item.src);
            removedIds.push(id);
            changed = true;
            continue;
        }

        if (
            record.kind !== normalized.record.kind
            || record.hash !== normalized.record.hash
            || record.width !== normalized.record.width
            || record.height !== normalized.record.height
            || record.selected !== undefined
        ) {
            changed = true;
        }

        seenHashes.set(normalized.item.hash, normalized);
        normalizedEntries.push(normalized);
    }

    mediaItems = normalizedEntries.map(entry => entry.item);

    if (changed) {
        await Promise.all([
            ...normalizedEntries.map(entry => set(entry.id, entry.record, dataStore)),
            ...removedIds.map(id => del(id, dataStore))
        ]);
    }

    loaded = true;
    notify();
    return mediaItems;
}

export function subscribeToMediaItems(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function getMediaItems() {
    return mediaItems;
}

export function getLegacySelectedMediaId() {
    return legacySelectedMediaId;
}

export async function getPersistedActiveMediaId() {
    return await get<string>(ACTIVE_MEDIA_ID_KEY) ?? "";
}

export async function setPersistedActiveMediaId(id: string) {
    if (id) {
        await set(ACTIVE_MEDIA_ID_KEY, id);
    } else {
        await del(ACTIVE_MEDIA_ID_KEY);
    }
}

export async function ensureMediaItemsLoaded() {
    if (loaded) return mediaItems;
    if (!loadPromise) {
        loadPromise = loadMediaItems().finally(() => {
            loadPromise = null;
        });
    }

    return await loadPromise;
}

export async function addMediaBlob(blob: Blob) {
    await ensureMediaItemsLoaded();

    const media = await probeMedia(blob);
    if (!media) return null;

    const hash = await hashBlob(blob);
    const existing = mediaItems.find(item => item.hash === hash);
    if (existing) {
        URL.revokeObjectURL(media.src);
        return existing;
    }

    const item: MediaItem = {
        ...media,
        id: createMediaId(),
        hash
    };

    mediaItems = [...mediaItems, item];
    await set(item.id, toStoredMediaRecord(item), dataStore);
    notify();
    return item;
}

export async function removeMediaItem(id: string) {
    await ensureMediaItemsLoaded();

    const item = mediaItems.find(media => media.id === id);
    if (!item) return false;

    URL.revokeObjectURL(item.src);
    mediaItems = mediaItems.filter(media => media.id !== id);
    await del(id, dataStore);
    notify();
    return true;
}

export async function clearMediaLibrary() {
    await ensureMediaItemsLoaded();

    releaseMediaUrls();
    mediaItems = [];
    await Promise.all([
        clear(dataStore),
        del(ACTIVE_MEDIA_ID_KEY)
    ]);
    notify();
}

export function releaseMediaLibrary(notifyListeners = true) {
    releaseMediaUrls();
    mediaItems = [];
    legacySelectedMediaId = "";
    loaded = false;
    loadPromise = null;
    if (notifyListeners) {
        notify();
    }
}
