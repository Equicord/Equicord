/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { fetchLyrica } from "@equicordplugins/musicControls/spotify/lyrics/providers/lyricaAPI";
import { Track } from "@equicordplugins/musicControls/tidal/TidalStore";

import { EnhancedLyric } from "./types";

export async function getLyrics(track: Track | null, retries = 3): Promise<EnhancedLyric[] | null> {
    if (!track?.name || !track?.artist) return null;

    try {
        const lyrics = await fetchLyrica(track.artist, track.name);
        return lyrics?.map(({ time, text }) => ({ time, text: text ?? "" })) ?? null;
    } catch (err) {
        if (retries > 1) return getLyrics(track, retries - 1);
        console.error("Error fetching lyrics:", err);
        return null;
    }
}
