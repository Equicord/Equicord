/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin from "@utils/types";
import { WindowStore } from "@webpack/common";
import { EquicordDevs } from "@utils/constants";

let originalHasFocus: () => boolean;
let originalIsFocused: (() => boolean) | undefined;
let eventHandler: (e: Event) => void;

export default definePlugin({
    name: "AlwaysFocus",
    description: "Makes your discord client think it's always focussed",
    authors: [EquicordDevs.pannenkoekissus],

    start() {
        originalHasFocus = document.hasFocus;
        document.hasFocus = () => true;

        Object.defineProperty(document, "visibilityState", {
            get: () => "visible",
            configurable: true
        });

        Object.defineProperty(document, "hidden", {
            get: () => false,
            configurable: true
        });

        eventHandler = (e: Event) => {
            e.stopImmediatePropagation();
            e.stopPropagation();
        };

        window.addEventListener("blur", eventHandler, true);
        document.addEventListener("visibilitychange", eventHandler, true);

        try {
            if (WindowStore && typeof WindowStore.isFocused === "function") {
                originalIsFocused = WindowStore.isFocused;
                WindowStore.isFocused = () => true;
            }
        } catch (err) {
            console.error("[ContinueWatching] Failed to patch WindowStore", err);
        }
    },

    stop() {
        if (originalHasFocus) {
            document.hasFocus = originalHasFocus;
        }

        delete (document as any).visibilityState;
        delete (document as any).hidden;

        if (eventHandler) {
            window.removeEventListener("blur", eventHandler, true);
            document.removeEventListener("visibilitychange", eventHandler, true);
        }

        try {
            if (WindowStore && originalIsFocused) {
                WindowStore.isFocused = originalIsFocused;
            }
        } catch (err) {
            console.error("[ContinueWatching] Failed to unpatch WindowStore", err);
        }
    }
});
