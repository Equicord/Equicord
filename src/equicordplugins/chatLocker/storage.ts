/*
 * ChatLockButton – Persistent storage & lock state
 */

import { DataStore } from "@api/index";
import { SelectedChannelStore } from "@webpack/common";

export const DATASTORE_KEY = "ChatLockButton_data";
export const SALT = "ChatLockButton_2025_salt";

export let settingsCache: Record<string, string> | null = null;
let settingsLoaded = false;
let loadPromise: Promise<Record<string, string>> | null = null;

export function getCurrentId(): string | null {
    return SelectedChannelStore.getChannelId();
}

export async function loadAll(): Promise<Record<string, string>> {
    if (settingsCache !== null) return settingsCache;
    if (loadPromise) return loadPromise;

    loadPromise = (async () => {
        try {
            const data = await DataStore.get(DATASTORE_KEY) as Record<string, string> | undefined;
            if (data && typeof data === "object") {
                settingsCache = data;
                settingsLoaded = true;
                return data;
            }
        } catch (e) {
            console.warn("[ChatLockButton] Failed to load from DataStore:", e);
        }
        settingsCache = {};
        settingsLoaded = true;
        return settingsCache;
    })();

    return loadPromise;
}

export async function saveAll(data: Record<string, string>) {
    settingsCache = data;
    try {
        await DataStore.set(DATASTORE_KEY, data);
    } catch (e) {
        console.warn("[ChatLockButton] Failed to save to DataStore:", e);
    }
}

export async function getHash(id: string): Promise<string | null> {
    const data = await loadAll();
    return data[id] || null;
}

export async function setHash(id: string, hash: string | null) {
    const data = await loadAll();
    if (hash) data[id] = hash;
    else delete data[id];
    await saveAll(data);
}

export function hasPassword(id: string): boolean {
    return settingsCache?.[id] !== undefined;
}

// Lock state (in‑memory)
const unlocked = new Set<string>();

export const isUnlocked = (id: string) => unlocked.has(id);
export const unlock = (id: string) => unlocked.add(id);
export const lock = (id: string) => unlocked.delete(id);

export const isLocked = (id: string): boolean => {
    if (!settingsLoaded) return false;
    return settingsCache?.[id] !== undefined && !isUnlocked(id);
};