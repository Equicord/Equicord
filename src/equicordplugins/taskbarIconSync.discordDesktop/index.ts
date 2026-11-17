/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EquicordDevs, IS_WINDOWS } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin, { type PluginNative } from "@utils/types";
import type { FluxStore } from "@vencord/discord-types";
import { filters, findStore, mapMangledModule } from "@webpack";

const Native = VencordNative.pluginHelpers.TaskbarIconSync as PluginNative<typeof import("./native")>;
const logger = new Logger("TaskbarIconSync");
const defaultIcon = "AppIcon";
const customGlyphScale = 30 / 28; // Discord default is 30px, but the others are slighly smaller at 28, so we scale up

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

        // scale+circular crop
        const scale = Math.min(canvas.width / bitmap.width, canvas.height / bitmap.height) * customGlyphScale;
        const width = bitmap.width * scale;
        const height = bitmap.height * scale;
        context.beginPath();
        context.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2, 0, 2 * Math.PI);
        context.clip();
        context.drawImage(bitmap, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    } finally {
        bitmap.close();
    }

    return (await canvas.convertToBlob()).arrayBuffer();
}

async function restoreDefaultIcon() {
    try {
        const iconSetError = await Native.setWindowIcon(null);
        if (iconSetError) throw new Error(iconSetError);
    } catch (error) {
        logger.error("Could not restore the default icon", error);
    }
}

let unsubscribe: (() => void) | undefined;

export default definePlugin({
    name: "TaskbarIconSync",
    description: "Syncs the Windows taskbar icon with your Discord app icon.",
    authors: [EquicordDevs.vracto],

    start() {
        if (!IS_WINDOWS) return;

        const store: AppIconStore | null = findStore("AppIconPersistedStoreState");

        const { getIcon }: { getIcon?: (id: string) => { id: string; iconSource: string; }; } =
            mapMangledModule(["iconSource:", "expiresAt:", ".find("], {
                getIcon: filters.byCode("iconSource:", ".find("),
            });

        if (!store || !getIcon) {
            logger.error("Could not find Discord's app icon store or assets.");
            void restoreDefaultIcon();
            return;
        }

        let currentId: string | undefined;
        let request: AbortController | undefined;

        const syncIcon = async () => {
            const id = store.getCurrentDesktopIcon() ?? defaultIcon;
            if (id === currentId) return;

            currentId = id;
            request?.abort();

            const controller = new AbortController();
            request = controller;
            try {
                const icon = id === defaultIcon ? null : getIcon(id);

                if (id !== defaultIcon && icon?.id !== id) throw new Error("Discord did not provide an asset for the selected icon.");

                const png = icon
                    ? await loadIcon(icon.iconSource, AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]))
                    : null;

                if (controller.signal.aborted) return;
                const error = await Native.setWindowIcon(png);
                if (error) throw new Error(error);
            } catch (error) {
                if (controller.signal.aborted) return;
                currentId = undefined;
                logger.warn("Could not sync app icon", id, error);
                if (id !== defaultIcon) await restoreDefaultIcon();
            }
        };

        store.addChangeListener(syncIcon);

        unsubscribe = () => {
            store.removeChangeListener(syncIcon);
            request?.abort();
            void restoreDefaultIcon();
        };

        void syncIcon();
    },

    stop() {
        unsubscribe?.();
        unsubscribe = undefined;
    },
});
