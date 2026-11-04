/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { app, desktopCapturer, IpcMainInvokeEvent, screen } from "electron";

let cachedSources: Electron.DesktopCapturerSource[] = [];
let fetchPromise: Promise<Electron.DesktopCapturerSource[]> | null = null;
let lastFetch = 0;

app.whenReady().then(() => {
    screen.on("display-added", () => { lastFetch = 0; });
    screen.on("display-removed", () => { lastFetch = 0; });
    screen.on("display-metrics-changed", () => { lastFetch = 0; });
}).catch(() => {});

async function getSources() {
    if (cachedSources.length && Date.now() - lastFetch < 10_000) {
        return cachedSources;
    }
    if (fetchPromise) return fetchPromise;

    fetchPromise = desktopCapturer.getSources({
        types: ["screen"],
        thumbnailSize: { width: 0, height: 0 }
    }).then(sources => {
        cachedSources = sources;
        lastFetch = Date.now();
        fetchPromise = null;
        return sources;
    }).catch(() => {
        fetchPromise = null;
        return cachedSources;
    });

    return fetchPromise;
}

export async function getActiveScreenSource(_: IpcMainInvokeEvent, invert = false) {
    try {
        const displays = screen.getAllDisplays().filter(d => d.bounds.width > 0 && d.bounds.height > 0);
        if (displays.length <= 1) return null;

        const point = screen.getCursorScreenPoint();
        const display = screen.getDisplayNearestPoint(point);
        if (!display?.bounds?.width) return null;

        const sources = await getSources();
        if (sources.length <= 1) return null;

        const displayIdStr = String(display.id);
        const primary = screen.getPrimaryDisplay();

        let match = sources.find(s => s.display_id === displayIdStr)
            ?? sources.find(s => s.id === `screen:${displayIdStr}:0` || s.id === `screen:${displayIdStr}`);

        if (!match) {
            if (display.id === primary.id) {
                match = sources.find(s => s.id === "screen:0:0" || s.id === "screen:0");
            } else if (sources.length === 2) {
                match = sources.find(s => s.id !== "screen:0:0" && s.id !== "screen:0");
            } else {
                const idx = displays.findIndex(d => d.id === display.id);
                match = sources[idx];
            }
        }

        match ??= sources[0];
        if (!match) return null;

        if (invert && sources.length >= 2) {
            const currentId = match.id;
            const idx = sources.findIndex(s => s.id === currentId);
            if (idx !== -1) {
                match = sources[(idx + 1) % sources.length] ?? match;
            }
        }

        return {
            sourceId: match.id,
            sourceName: match.name,
            displayId: display.id
        };
    } catch {
        return null;
    }
}
