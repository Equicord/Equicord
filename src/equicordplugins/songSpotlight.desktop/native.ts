/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as handlers from "@equicordplugins/songSpotlight.desktop/lib/ssapi/handlers";
import type { Song } from "@equicordplugins/songSpotlight.desktop/lib/ssapi/structs";
import { setFetchHandler } from "@equicordplugins/songSpotlight.desktop/lib/ssapi/util";
import { CspPolicies,CSPSrc } from "@main/csp";
import { type IpcMainInvokeEvent, net } from "electron";

setFetchHandler(net.fetch as unknown as typeof fetch);

for (const host of [
    "dc.songspotlight.nexpid.xyz",
    "*.scdn.co",
    "*.sndcdn.com",
    "*.mzstatic.com",
    "audio-ssl.itunes.apple.com",
]) {
    CspPolicies[host] = CSPSrc;
}

export async function parseLink(_: IpcMainInvokeEvent, link: string) {
    return handlers.parseLink(link);
}
export async function renderSong(_: IpcMainInvokeEvent, song: Song) {
    return handlers.renderSong(song);
}
export async function validateSong(_: IpcMainInvokeEvent, song: Song) {
    return handlers.validateSong(song);
}

export function clearCache() {
    return handlers.clearCache();
}
