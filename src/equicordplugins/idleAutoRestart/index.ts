/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { definePluginSettings } from "@api/Settings";
import { Devs, EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";

const settings = definePluginSettings({
    enabled: {
        description: "Enable automatic restart after idle",
        type: OptionType.BOOLEAN,
        default: true,
    },
    idleMinutes: {
        description: "Minutes of no input before restart",
        type: OptionType.SLIDER,
        markers: [5, 10, 15, 30, 60, 120],
        default: 30,
        stickToMarkers: false,
    },
});

let lastActivity = Date.now();
let intervalId: number | null = null;
let listenersAttached = false;

function updateActivity() {
    lastActivity = Date.now();
}

function attachListeners() {
    if (listenersAttached) return;
    listenersAttached = true;

    window.addEventListener("mousemove", updateActivity);
    window.addEventListener("keydown", updateActivity);
    window.addEventListener("mousedown", updateActivity);
    window.addEventListener("wheel", updateActivity, { passive: true });
}

function detachListeners() {
    if (!listenersAttached) return;
    listenersAttached = false;

    window.removeEventListener("mousemove", updateActivity);
    window.removeEventListener("keydown", updateActivity);
    window.removeEventListener("mousedown", updateActivity);
    window.removeEventListener("wheel", updateActivity as any);
}

function startTimer() {
    if (intervalId != null) return;

    intervalId = window.setInterval(() => {
        if (!settings.store.enabled) return;

        const idleMs = settings.store.idleMinutes * 60 * 1000;
        const sinceActivity = Date.now() - lastActivity;

        if (sinceActivity >= idleMs) {
            location.reload();
        }
    }, 30 * 1000);
}

function stopTimer() {
    if (intervalId == null) return;
    window.clearInterval(intervalId);
    intervalId = null;
}

export default definePlugin({
    name: "IdleAutoRestart",
    description:
        "Automatically restarts the client after being idle for a configurable amount of time.",
    authors: [EquicordDevs.SteelTech],
    settings,

    start() {
        lastActivity = Date.now();
        attachListeners();
        startTimer();
    },

    stop() {
        stopTimer();
        detachListeners();
    },
});
