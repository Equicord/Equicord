import { popNotice, showNotice } from "@api/Notices";
import { Devs, EquicordDevs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin, { ReporterTestable } from "@utils/types";
import { findByCodeLazy } from "@webpack";
import { ApplicationAssetUtils, FluxDispatcher, Toasts } from "@webpack/common";

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

export default definePlugin({
    name: "arRPC-bun",
    description: "arRPC-bun integration",
    authors: [EquicordDevs.creations],
    reporterTestable: ReporterTestable.None,
    enabledByDefault: IS_EQUIBOP,
    hidden: !IS_EQUIBOP && !IS_VESKTOP,

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
        // only works on 3.0.8+
        if (IS_EQUIBOP) {
            const version = VesktopNative.app.getVersion();
            const [major, minor, patch] = version.split(".").map(Number);

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

        // if on equibop and arRPC is disabled AND not running, warn user
        if (IS_EQUIBOP && !arrpcStatus?.enabled && !arrpcStatus?.running) {
            logger.warn("Equibop's built-in arRPC is disabled and not running");
            showNotice("arRPC is not running. Enable it in Equibop settings, or run your own arRPC-bun server.", "OK", () => {
                popNotice();
            });
            return;
        }

        const host = arrpcStatus?.host || "127.0.0.1";
        const port = arrpcStatus?.port || 1337;

        const wsUrl = `ws://${host}:${port}`;
        logger.info(`Connecting to arRPC-bun at ${wsUrl}${arrpcStatus?.host ? "" : " (using defaults)"}`);

        if (ws) ws.close();
        ws = new WebSocket(wsUrl);

        ws.onmessage = this.handleEvent;

        ws.onerror = (error) => {
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
        Toasts.show({
            message: "Connected to arRPC-bun",
            type: Toasts.Type.SUCCESS,
            id: Toasts.genId(),
            options: {
                duration: 1000,
                position: Toasts.Position.BOTTOM
            }
        });
    },

    stop() {
        FluxDispatcher.dispatch({ type: "LOCAL_ACTIVITY_UPDATE", activity: null });
        ws?.close();
        logger.info("Stopped arRPC-bun connection");
    }
});
