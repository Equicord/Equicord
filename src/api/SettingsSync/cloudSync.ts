/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";
import { showNotification } from "@api/Notifications";
import { PlainSettings, Settings } from "@api/Settings";
import { localStorage } from "@utils/localStorage";
import { Logger } from "@utils/Logger";
import { relaunch } from "@utils/native";
import { SettingsRouter } from "@webpack/common";

import { deauthorizeCloud, getCloudAuth, getCloudUrl } from "./cloudSetup";
import { importSettings } from "./offline";
import { ManifestEntry, SyncRequest, SyncResponse } from "./types";

const logger = new Logger("SettingsSync:Cloud", "#39b7e0");

const MANIFEST_STORE_KEY = "Vencord_cloudManifest";

function toBase64(data: Uint8Array): string {
    let binary = "";
    for (let i = 0; i < data.length; i++)
        binary += String.fromCharCode(data[i]);
    return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++)
        bytes[i] = binary.charCodeAt(i);
    return bytes;
}

async function computeChecksum(data: Uint8Array): Promise<string> {
    const hash = await crypto.subtle.digest("SHA-256", data as ArrayBuffer);
    const bytes = new Uint8Array(hash, 0, 8);
    return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

async function getLocalManifest(): Promise<ManifestEntry[]> {
    return await DataStore.get<ManifestEntry[]>(MANIFEST_STORE_KEY) ?? [];
}

async function saveLocalManifest(manifest: ManifestEntry[]) {
    await DataStore.set(MANIFEST_STORE_KEY, manifest);
}

async function buildLocalData(): Promise<Map<string, Uint8Array>> {
    const encoder = new TextEncoder();
    const data = new Map<string, Uint8Array>();

    data.set("settings", encoder.encode(JSON.stringify(VencordNative.settings.get())));

    const quickCss = await VencordNative.quickCss.get();
    if (quickCss) data.set("quickCss", encoder.encode(quickCss));

    return data;
}

async function applyDownloads(downloads: SyncResponse["downloads"]) {
    if (downloads.length === 0) return false;

    let settingsChanged = false;
    const decoder = new TextDecoder();

    for (const dl of downloads) {
        const text = decoder.decode(fromBase64(dl.value));

        if (dl.key === "settings") {
            try {
                await importSettings(JSON.stringify({ settings: JSON.parse(text) }), "all", true);
                settingsChanged = true;
            } catch (e) {
                logger.error("Failed to apply settings download", e);
            }
        } else if (dl.key === "quickCss") {
            await VencordNative.quickCss.set(text);
            settingsChanged = true;
        } else if (dl.key.startsWith("dataStore/")) {
            const dsKey = dl.key.slice("dataStore/".length);
            try {
                await DataStore.set(dsKey, JSON.parse(text));
            } catch (e) {
                logger.error(`Failed to apply dataStore download for ${dsKey}`, e);
            }
        }
    }

    return settingsChanged;
}

async function doSync(uploads: SyncRequest["uploads"], clientManifest: ManifestEntry[]): Promise<SyncResponse | null> {
    const res = await fetch(new URL("/v2/sync", getCloudUrl()), {
        method: "POST",
        headers: {
            Authorization: await getCloudAuth(),
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ client_manifest: clientManifest, uploads } satisfies SyncRequest),
    });

    if (res.status === 401) {
        showNotification({
            title: "Cloud Settings",
            body: "Cloud sync was disabled because this account isn't connected. Reconnect in Cloud Settings.",
            color: "var(--yellow-360)",
            onClick: () => SettingsRouter.openUserSettings("equicord_cloud_panel"),
        });
        Settings.cloud.authenticated = false;
        return null;
    }

    if (!res.ok) {
        logger.error(`Sync failed, API returned ${res.status}`);
        showNotification({
            title: "Cloud Settings",
            body: `Could not synchronize settings (API returned ${res.status}).`,
            color: "var(--red-360)",
        });
        return null;
    }

    return await res.json();
}

export function shouldCloudSync(direction: "push" | "pull") {
    const localDirection = localStorage.Vencord_cloudSyncDirection;
    return localDirection === direction || localDirection === "both";
}

export async function putCloudSettings(manual?: boolean) {
    try {
        const localManifest = await getLocalManifest();
        const manifestMap = new Map(localManifest.map(e => [e.key, e]));

        const localData = await buildLocalData();
        const uploads: SyncRequest["uploads"] = [];

        for (const [key, value] of localData) {
            const checksum = await computeChecksum(value);
            const existing = manifestMap.get(key);

            if (!existing || existing.checksum !== checksum) {
                uploads.push({ key, value: toBase64(value), checksum });
            }
        }

        if (uploads.length === 0 && !manual) {
            logger.info("No changes to push");
            delete localStorage.Vencord_settingsDirty;
            return;
        }

        const response = await doSync(uploads, localManifest);
        if (!response) return;

        for (const err of response.errors)
            logger.error(`Sync error for ${err.key}: ${err.error}`);

        const hadDownloads = await applyDownloads(response.downloads);
        await saveLocalManifest(response.server_manifest);

        PlainSettings.cloud.settingsSyncVersion = Date.now();
        await VencordNative.settings.set(PlainSettings);

        logger.info(`Sync complete: ${response.uploaded.length} uploaded, ${response.downloads.length} downloaded`);

        if (manual) {
            showNotification({
                title: "Cloud Settings",
                body: hadDownloads
                    ? "Settings synced! Click here to restart to fully apply changes."
                    : "Settings synchronized to the cloud!",
                color: "var(--green-360)",
                onClick: hadDownloads ? (IS_WEB ? () => location.reload() : relaunch) : undefined,
                noPersist: true,
            });
        }

        delete localStorage.Vencord_settingsDirty;
    } catch (e: any) {
        logger.error("Failed to sync up", e);
        showNotification({
            title: "Cloud Settings",
            body: `Could not synchronize settings to the cloud (${e.toString()}).`,
            color: "var(--red-360)",
        });
    }
}

export async function getCloudSettings(shouldNotify = true, force = false) {
    try {
        const localManifest = force ? [] : await getLocalManifest();

        const response = await doSync([], localManifest);
        if (!response) return false;

        for (const err of response.errors)
            logger.error(`Sync error for ${err.key}: ${err.error}`);

        if (response.downloads.length === 0) {
            logger.info("Settings up to date");
            if (shouldNotify)
                showNotification({
                    title: "Cloud Settings",
                    body: "Your settings are up to date.",
                    noPersist: true,
                });
            return false;
        }

        const settingsChanged = await applyDownloads(response.downloads);
        await saveLocalManifest(response.server_manifest);

        PlainSettings.cloud.settingsSyncVersion = Date.now();
        await VencordNative.settings.set(PlainSettings);

        logger.info(`Pulled ${response.downloads.length} keys from cloud`);

        if (shouldNotify)
            showNotification({
                title: "Cloud Settings",
                body: settingsChanged
                    ? "Your settings have been updated! Click here to restart to fully apply changes!"
                    : "Cloud data synchronized.",
                color: "var(--green-360)",
                onClick: settingsChanged ? (IS_WEB ? () => location.reload() : relaunch) : undefined,
                noPersist: true,
            });

        delete localStorage.Vencord_settingsDirty;
        return true;
    } catch (e: any) {
        logger.error("Failed to sync down", e);
        showNotification({
            title: "Cloud Settings",
            body: `Could not synchronize settings from the cloud (${e.toString()}).`,
            color: "var(--red-360)",
        });
        return false;
    }
}

export async function deleteCloudSettings() {
    try {
        const auth = await getCloudAuth();

        const manifestRes = await fetch(new URL("/v2/manifest", getCloudUrl()), {
            headers: { Authorization: auth },
        });

        if (!manifestRes.ok) {
            showNotification({
                title: "Cloud Settings",
                body: `Could not fetch manifest for deletion (API returned ${manifestRes.status}).`,
                color: "var(--red-360)",
            });
            return;
        }

        const { entries }: { entries: ManifestEntry[] } = await manifestRes.json();

        await Promise.all(entries.map(async entry => {
            const res = await fetch(new URL(`/v2/data/${encodeURIComponent(entry.key)}`, getCloudUrl()), {
                method: "DELETE",
                headers: { Authorization: auth },
            });
            if (!res.ok && res.status !== 404)
                logger.error(`Failed to delete key ${entry.key}: ${res.status}`);
        }));

        await saveLocalManifest([]);

        PlainSettings.cloud.settingsSyncVersion = 0;
        await VencordNative.settings.set(PlainSettings);

        logger.info("Settings deleted from cloud successfully");
        showNotification({
            title: "Cloud Settings",
            body: "Settings deleted from cloud!",
            color: "var(--green-360)",
        });
    } catch (e: any) {
        logger.error("Failed to delete", e);
        showNotification({
            title: "Cloud Settings",
            body: `Could not delete settings (${e.toString()}).`,
            color: "var(--red-360)",
        });
    }
}

export async function eraseAllCloudData() {
    const res = await fetch(new URL("/v1/", getCloudUrl()), {
        method: "DELETE",
        headers: { Authorization: await getCloudAuth() },
    });

    if (!res.ok) {
        logger.error(`Failed to erase data, API returned ${res.status}`);
        showNotification({
            title: "Cloud Integrations",
            body: `Could not erase all data (API returned ${res.status}), please contact support.`,
            color: "var(--red-360)",
        });
        return;
    }

    Settings.cloud.authenticated = false;
    await deauthorizeCloud();
    await saveLocalManifest([]);

    showNotification({
        title: "Cloud Integrations",
        body: "Successfully erased all data.",
        color: "var(--green-360)",
    });
}
