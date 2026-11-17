/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IS_WINDOWS } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin, { type PluginNative } from "@utils/types";
import type { FluxStore } from "@vencord/discord-types";
import { filters, findStore, mapMangledModule } from "@webpack";

const Native = VencordNative.pluginHelpers.SyncTaskbarIcon as PluginNative<typeof import("./native")>;
const logger = new Logger("SyncTaskbarIcon");
const defaultIcon = "AppIcon";

interface AppIconStore extends FluxStore {
    getCurrentDesktopIcon(): string | undefined;
}

async function loadIcon(source: string, signal: AbortSignal) {
    const response = await fetch(source, { signal, credentials: "omit" });
    if (!response.ok) throw new Error("Could not load Discord's icon.");

    const bitmap = await createImageBitmap(await response.blob());
    const canvas = new OffscreenCanvas(128, 128);
    try {
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Could not create an icon canvas.");

        const scale = Math.min(canvas.width / bitmap.width, canvas.height / bitmap.height);
        const width = bitmap.width * scale;
        const height = bitmap.height * scale;
        context.drawImage(bitmap, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    } finally {
        bitmap.close();
    }

    return (await canvas.convertToBlob()).arrayBuffer();
}

let unsubscribe: (() => void) | undefined;

export default definePlugin({
    name: "SyncTaskbarIcon",
    description: "Keeps the Windows taskbar icon in sync with your Discord app icon.",
    authors: [{ name: "vracton", id: 0n }],

    start() {
        if (!IS_WINDOWS) return;

        const store: AppIconStore | null = findStore("AppIconPersistedStoreState");
        const { getIcon }: { getIcon?: (id: string) => { id: string; iconSource: string; }; } =
            mapMangledModule(["iconSource:", "expiresAt:", ".find("], {
                getIcon: filters.byCode("iconSource:", ".find("),
            });
        if (!store || !getIcon) {
            logger.error("Could not find Discord's app icon store or assets.");
            return;
        }

        let requestedId: string | undefined;
        let request: AbortController | undefined;

        const syncIcon = async () => {
            const id = store.getCurrentDesktopIcon() ?? defaultIcon;
            if (id === requestedId) return;
            requestedId = id;
            request?.abort();

            const controller = new AbortController();
            request = controller;
            try {
                const icon = id === defaultIcon ? null : getIcon(id);
                const png = icon?.id === id
                    ? await loadIcon(icon.iconSource, AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]))
                    : null;

                if (controller.signal.aborted) return;
                if (!await Native.setWindowIcon(png)) throw new Error("Could not update the Windows icon.");
            } catch (error) {
                if (controller.signal.aborted) return;
                requestedId = undefined;
                logger.error(error);
            }
        };

        store.addChangeListener(syncIcon);
        unsubscribe = () => {
            store.removeChangeListener(syncIcon);
            request?.abort();
            Native.setWindowIcon(null).catch(error => logger.error(error));
        };
        void syncIcon();
    },

    stop() {
        unsubscribe?.();
        unsubscribe = undefined;
    },
});
