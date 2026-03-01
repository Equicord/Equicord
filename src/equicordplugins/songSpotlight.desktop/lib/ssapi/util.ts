/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { $, setFetchHandler } from "./finders";
import type { RenderSongInfo, Song } from "./types";

export { setFetchHandler };

export function isListLayout(song: Song, render?: RenderSongInfo): boolean {
    return render?.form === "list" || !["track", "song"].includes(song.type);
}

export function getServiceLabel(service: string): string | undefined {
    for (const serviced of $.services) {
        if (serviced.name === service) return serviced.label;
    }
}

export function sid(song: Song): string {
    return [song.service, song.type, song.id].join(":");
}
