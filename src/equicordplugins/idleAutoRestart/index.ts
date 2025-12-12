/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs, EquicordDevs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { SelectedChannelStore, UserStore } from "@webpack/common";

const logger = new Logger("IdleAutoRestart");

const settings = definePluginSettings({
    enabled: {
        description: "Enable automatic restart after idle",
        type: OptionType.BOOLEAN,
        default: true,
    },
    idleMinutes: {
        description: "Minutes of inactivity before restarting (when not in VC)",
        type: OptionType.SLIDER,
        markers: [5, 10, 15, 30, 60, 120],
        default: 30,
        stickToMarkers: false,
    },
});

let lastActivity = 0;
let intervalId: ReturnType<typeof setInterval> | null = null;

function onActivity() {
    lastActivity = Date.now();
}

function isInVoice(): boolean {
    return !!SelectedChannelStore.getVoiceChannelId();
}

export default definePlugin({
    name: "IdleAutoRestart",
    description:
        "Automatically restarts the client after being idle for a configurable amount of time, but avoids restarting while you are in VC.",
    authors: [EquicordDevs.SteelTech ?? Devs.Ven],
    settings,


    start() {
        lastActivity = Date.now();

        document.addEventListener("mousemove", onActivity);
        document.addEventListener("keydown", onActivity);
        document.addEventListener("mousedown", onActivity);
        document.addEventListener("wheel", onActivity, { passive: true });

        if (intervalId) clearInterval(intervalId);
        intervalId = setInterval(() => {
            if (!settings.store.enabled) return;

            if (isInVoice()) {
                return;
            }

            const idleMs = settings.store.idleMinutes * 60_000;
            if (Date.now() - lastActivity >= idleMs) {
                logger.info("Idle timeout reached, reloading client");
                location.reload();
            }
        }, 30_000);
    },

    stop() {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }

        document.removeEventListener("mousemove", onActivity);
        document.removeEventListener("keydown", onActivity);
        document.removeEventListener("mousedown", onActivity);
        document.removeEventListener("wheel", onActivity as any);
    },
});
