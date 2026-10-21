/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DataStore } from "@api/index";

const SIZES_KEY = "__sizes";
const LEGACY_PREFIX = "VoiceMessageTranscriber_";

let store: ReturnType<typeof DataStore.createStore> | undefined;
const getStore = () => store ??= DataStore.createStore("VoiceMessageTranscriberData", "VoiceMessageTranscriberStore");

export function getCachedFile(url: string) {
    return DataStore.get<ArrayBuffer>(url, getStore());
}

export async function cacheFile(url: string, data: ArrayBuffer) {
    await DataStore.set(url, data, getStore());
    await DataStore.update<Record<string, number>>(SIZES_KEY, sizes => ({ ...sizes, [url]: data.byteLength }), getStore());
}

export async function getCacheSize() {
    const sizes = await DataStore.get<Record<string, number>>(SIZES_KEY, getStore()) ?? {};
    return Object.values(sizes).reduce((total, size) => total + size, 0);
}

export function clearCache() {
    return DataStore.clear(getStore());
}

export async function deleteLegacyCache() {
    const keys = await DataStore.keys();
    const legacy = keys.filter(key => typeof key === "string" && key.startsWith(LEGACY_PREFIX));
    if (legacy.length) await DataStore.delMany(legacy);
}
