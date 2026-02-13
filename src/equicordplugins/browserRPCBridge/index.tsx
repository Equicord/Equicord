/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType, PluginNative } from "@utils/types";
import { ApplicationAssetUtils, fetchApplicationsRPC, FluxDispatcher, Toasts } from "@webpack/common";

const settings = definePluginSettings({
    showNotifications: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Show toast notifications when status updates",
    },
    port: {
        type: OptionType.NUMBER,
        default: 6969,
        description: "WebSocket Server Port (Requires Restart)",
    },
});

let isStarted = false;
let pauseTimeout: ReturnType<typeof setTimeout> | null = null;
const PAUSE_CLEAR_DELAY = 20_000;

function clearPresence() {
    FluxDispatcher.dispatch({
        type: "LOCAL_ACTIVITY_UPDATE",
        activity: null,
        socketId: "external-rpc-extension",
    });
}

function clearPauseTimeout() {
    if (pauseTimeout) {
        clearTimeout(pauseTimeout);
        pauseTimeout = null;
    }
}

// Resolve image keys to Discord-compatible asset IDs with caching
const assetCache: Record<string, string> = {};
async function lookupAsset(applicationId: string, key: string): Promise<string> {
    const cacheKey = `${applicationId}:${key}`;
    if (assetCache[cacheKey]) return assetCache[cacheKey];

    try {
        const id = (await ApplicationAssetUtils.fetchAssetIds(applicationId, [key]))[0];
        if (id) assetCache[cacheKey] = id;
        return id;
    } catch {
        return key;
    }
}

// Lookup application info from Discord
const appCache: Record<string, any> = {};
async function lookupApp(applicationId: string): Promise<any> {
    if (appCache[applicationId]) return appCache[applicationId];
    const socket: any = {};
    await fetchApplicationsRPC(socket, applicationId);
    appCache[applicationId] = socket.application;
    return socket.application;
}

// Ensure timestamps are in milliseconds
function ensureMilliseconds(ts: number): number {
    if (ts < 1e12) return ts * 1000;
    return ts;
}

// Handle incoming messages from native process
async function handleNativeMessage(_event: any, data: any) {
    if (!data?.presence) {
        if (data?.action === "disconnect" || data?.action === "clear") {
            clearPauseTimeout();
            clearPresence();
        }
        return;
    }

    const p = data.presence;
    const clientId = p.clientId || data.clientId;
    if (!clientId) return;

    // Resolve application name
    let appName = "Rich Presence";
    try {
        const app = await lookupApp(clientId);
        if (app?.name) appName = app.name;
    } catch { }

    const activity: any = {
        application_id: clientId,
        name: p.name || appName,
        type: p.type ?? 0,
        flags: 1,
    };

    if (p.details) activity.details = p.details;
    if (p.state) activity.state = p.state;

    // Resolve image assets
    const assets: any = {};
    if (p.largeImageKey) {
        try { assets.large_image = await lookupAsset(clientId, p.largeImageKey); } catch { }
    }
    if (p.largeImageText) assets.large_text = p.largeImageText;
    if (p.smallImageKey) {
        try { assets.small_image = await lookupAsset(clientId, p.smallImageKey); } catch { }
    }
    if (p.smallImageText) assets.small_text = p.smallImageText;
    if (Object.keys(assets).length > 0) activity.assets = assets;

    // Timestamps
    const timestamps: any = {};
    if (p.startTimestamp) timestamps.start = ensureMilliseconds(p.startTimestamp);
    if (p.endTimestamp) timestamps.end = ensureMilliseconds(p.endTimestamp);
    if (Object.keys(timestamps).length > 0) activity.timestamps = timestamps;

    // Buttons
    if (p.buttons?.length) {
        activity.buttons = p.buttons.map((b: any) => b.label || b);
        activity.metadata = {
            button_urls: p.buttons.map((b: any) => b.url || b),
        };
    }

    // Detect pause state and start clear timeout
    const isPaused = p.smallImageKey === "pause" || p.smallImageText === "Paused";

    if (isPaused) {
        // Only start timeout if not already running
        if (!pauseTimeout) {
            pauseTimeout = setTimeout(() => {
                clearPresence();
                pauseTimeout = null;
            }, PAUSE_CLEAR_DELAY);
        }
    } else {
        // Playing - cancel any pending pause timeout
        clearPauseTimeout();
    }

    FluxDispatcher.dispatch({
        type: "LOCAL_ACTIVITY_UPDATE",
        activity,
        socketId: "external-rpc-extension",
    });
}

const Native = VencordNative.pluginHelpers.BrowserRPCBridge as PluginNative<typeof import("./native")>;

export default definePlugin({
    name: "BrowserRPCBridge",
    description: "Allows browser extensions to update your Discord status via a local WebSocket server (Default Port: 6969).",
    authors: [EquicordDevs.feniks],
    settings,

    start() {
        try {
            const { port } = settings.store;
            // @ts-ignore: Native types might not be updated yet
            Native.startServer(port);
            if (settings.store.showNotifications) {
                Toasts.show({
                    message: `RPC Bridge Server Started on Port ${port}`,
                    type: Toasts.Type.SUCCESS,
                    id: Toasts.genId()
                });
            }
            isStarted = true;
        } catch (e) {
            console.error("[BrowserRPCBridge] Failed to start:", e);
        }
    },

    stop() {
        if (isStarted) {
            Native.stopServer();
            clearPauseTimeout();
            clearPresence();
            isStarted = false;
        }
    },

    handleUpdate(data: any) {
        handleNativeMessage(null, data);
    },

    handleConnection() {
        if (settings.store.showNotifications) {
            Toasts.show({
                message: "RPC Client Connected!",
                type: Toasts.Type.SUCCESS,
                id: Toasts.genId()
            });
        }
    },

    handleDebug(_msg: string) { }
});
