/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { popNotice, showNotice } from "@api/Notices";
import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import { isAnyPluginDev, isEquicordGuild } from "@utils/misc";
import definePlugin, { OptionType, ReporterTestable } from "@utils/types";
import { findByCodeLazy } from "@webpack";
import { ApplicationAssetUtils, FluxDispatcher, Toasts, UserStore } from "@webpack/common";

const fetchApplicationsRPC = findByCodeLazy('"Invalid Origin"', ".application");
const logger = new Logger("arRPC-bun");

async function lookupAsset(applicationId: string, key: string): Promise<string> {
    return (await ApplicationAssetUtils.fetchAssetIds(applicationId, [key]))[0];
}

const apps: any = {};
async function lookupApp(applicationId: string): Promise<string> {
    const socket: any = {};
    await fetchApplicationsRPC(socket, applicationId);
    return socket.application;
}

let ws: WebSocket;

console.log("[arRPC-bun] Plugin module loaded");

export const settings = definePluginSettings({
    oneTimeNotice: {
        type: OptionType.BOOLEAN,
        description: "One time notice check for showing arrpc disabled",
        default: false,
        hidden: true
    },
});


export default definePlugin({
    name: "arRPC-bun",
    description: "arRPC-bun integration - connects to bridge on port 1337",
    authors: [EquicordDevs.creations],
    reporterTestable: ReporterTestable.None,
    enabledByDefault: IS_EQUIBOP,
    hidden: !IS_EQUIBOP && !IS_VESKTOP && !("legcord" in window),
    settings,

    commands: [
        {
            name: "arrpc-debug",
            description: "Show arRPC-bun debug information",
            predicate: ctx => {
                const result = isAnyPluginDev(UserStore.getCurrentUser()?.id) || isEquicordGuild(ctx?.guild?.id, true);
                console.log("[arRPC-bun] predicate check:", result, "user:", UserStore.getCurrentUser()?.id, "guild:", ctx?.guild?.id);
                return result;
            },
            execute: () => {
                console.log("[arRPC-bun] execute called!");
                const arrpcStatus = IS_EQUIBOP ? VesktopNative.arrpc?.getStatus?.() : null;
                console.log("[arRPC-bun] arrpcStatus:", arrpcStatus);

                let content = "";

                if (IS_EQUIBOP) {
                    const version = VesktopNative.app.getVersion();
                    const gitHash = VesktopNative.app.getGitHash?.();
                    const shortHash = gitHash?.slice(0, 7);

                    content += `Equibop: v${version}`;
                    if (shortHash) {
                        content += ` • [${shortHash}](<https://github.com/Equicord/Equibop/commit/${gitHash}>)`;
                    }
                    content += "\n";
                }

                if (arrpcStatus) {
                    content += `Running: ${arrpcStatus.running ? "Yes" : "No"}\n`;
                    content += `Enabled: ${arrpcStatus.enabled ? "Yes" : "No"}\n`;

                    if (arrpcStatus.running) {
                        content += `Port: ${arrpcStatus.port}\n`;
                        content += `PID: ${arrpcStatus.pid}\n`;

                        if (arrpcStatus.uptime) {
                            const seconds = Math.floor(arrpcStatus.uptime / 1000);
                            const minutes = Math.floor(seconds / 60);
                            const hours = Math.floor(minutes / 60);

                            if (hours > 0) {
                                content += `Uptime: ${hours}h ${minutes % 60}m ${seconds % 60}s\n`;
                            } else if (minutes > 0) {
                                content += `Uptime: ${minutes}m ${seconds % 60}s\n`;
                            } else {
                                content += `Uptime: ${seconds}s\n`;
                            }
                        }
                    }

                    const info = [
                        arrpcStatus.restartCount > 0 && ["Restarts", arrpcStatus.restartCount],
                        arrpcStatus.bunPath && ["Bun", arrpcStatus.bunPath],
                        arrpcStatus.warnings?.length && ["Warnings", arrpcStatus.warnings.join(", ")],
                        arrpcStatus.lastError && ["Last Error", arrpcStatus.lastError],
                        arrpcStatus.lastExitCode && arrpcStatus.lastExitCode !== 0 && ["Exit Code", arrpcStatus.lastExitCode]
                    ].filter(Boolean);

                    content += info.map(([type, value]) => `${type}: ${value}`).join("\n");
                } else {
                    if (ws) {
                        content += ws.readyState === WebSocket.OPEN
                            ? "WebSocket: Connected to external arRPC-bun server\n"
                            : `WebSocket: ${["Connecting", "Open", "Closing", "Closed"][ws.readyState]}\n`;
                    } else {
                        content += "WebSocket: Not connected\n";
                    }
                }

                console.log("[arRPC-bun] returning:", { content });
                return { content };
            },
        },
    ],

    async handleEvent(e: MessageEvent<any>) {
        const data = JSON.parse(e.data);

        const { activity } = data;
        const assets = activity?.assets;

        if (assets?.large_image) assets.large_image = await lookupAsset(activity.application_id, assets.large_image);
        if (assets?.small_image) assets.small_image = await lookupAsset(activity.application_id, assets.small_image);

        if (activity) {
            const appId = activity.application_id;
            apps[appId] ||= await lookupApp(appId);

            const app = apps[appId];
            activity.name ||= app.name;
        }

        FluxDispatcher.dispatch({ type: "LOCAL_ACTIVITY_UPDATE", ...data });
    },

    async start() {
        console.log("[arRPC-bun] Plugin starting...");
        // only works on 3.0.8+
        if (IS_EQUIBOP) {
            const version = VesktopNative.app.getVersion();
            const [major, minor, patch] = version.split(".").map(Number);
            console.log("[arRPC-bun] Equibop version:", version);

            if (major < 3 || (major === 3 && minor === 0 && patch < 8)) {
                logger.error(`Equibop ${version} is too old. Requires 3.0.8+ for arRPC-bun fix.`);
                showNotice(`arRPC-bun requires Equibop 3.0.8+. You have ${version}. Update Equibop to use this plugin.`, "OK", () => {
                    popNotice();
                });
                return;
            }
        }

        // disable WebRichPresence to avoid conflicts
        const webRPC = Vencord.Plugins.plugins.WebRichPresence;
        if (webRPC && Vencord.Plugins.isPluginEnabled("WebRichPresence")) {
            logger.info("Disabling WebRichPresence to avoid conflicts");
            Vencord.Plugins.stopPlugin(webRPC);
        }

        // get arRPC status from Equibop if available, otherwise use defaults
        const arrpcStatus = IS_EQUIBOP ? VesktopNative.arrpc?.getStatus?.() : null;
        console.log("[arRPC-bun] Got arRPC status:", arrpcStatus);

        // if on Equibop and arRPC is disabled AND not running, warn user
        if (IS_EQUIBOP && !arrpcStatus?.enabled && !arrpcStatus?.running && !settings.store.oneTimeNotice) {
            logger.warn("Equibop's built-in arRPC is disabled and not running");
            showNotice("arRPC is not running. Enable it in Equibop settings, or run your own arRPC-bun server.", "OK", () => {
                popNotice();
            });
            console.log("[arRPC-bun] Early return due to arRPC not enabled/running");
            return;
        }

        const host = arrpcStatus?.host || "127.0.0.1";
        const port = arrpcStatus?.port || 1337;

        const wsUrl = `ws://${host}:${port}`;
        logger.info(`Connecting to arRPC-bun at ${wsUrl}${arrpcStatus?.host ? "" : " (using defaults)"}`);
        console.log("[arRPC-bun] Creating WebSocket connection to:", wsUrl);

        if (ws) ws.close();
        ws = new WebSocket(wsUrl);

        ws.onmessage = this.handleEvent;

        ws.onerror = error => {
            logger.error("WebSocket error:", error);
        };

        ws.onclose = () => {
            logger.info("WebSocket closed");
        };

        const connectionSuccessful = await new Promise(res => setTimeout(() => res(ws.readyState === WebSocket.OPEN), 5000));
        if (!connectionSuccessful) {
            logger.error("Failed to connect to arRPC-bun");
            showNotice("Failed to connect to arRPC-bun, is it running?", "Retry", () => {
                popNotice();
                this.start();
            });
            return;
        }

        logger.info("Successfully connected to arRPC-bun");
        console.log("[arRPC-bun] Successfully connected to arRPC-bun");
        Toasts.show({
            message: "Connected to arRPC-bun",
            type: Toasts.Type.SUCCESS,
            id: Toasts.genId(),
            options: {
                duration: 1000,
                position: Toasts.Position.BOTTOM
            }
        });
        console.log("[arRPC-bun] Plugin start() completed successfully");
    },

    stop() {
        FluxDispatcher.dispatch({ type: "LOCAL_ACTIVITY_UPDATE", activity: null });
        ws?.close();
        logger.info("Stopped arRPC-bun connection");
    }
});
