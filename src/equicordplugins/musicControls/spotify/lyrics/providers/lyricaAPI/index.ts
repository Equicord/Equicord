/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { LyricsData, Provider, SyncedLyric } from "@equicordplugins/musicControls/spotify/lyrics/providers/types";
import { Track } from "@equicordplugins/musicControls/spotify/SpotifyStore";

const baseUrlLyrica = "https://lyrica.thororen.com/lyrics/";

interface LyricaResponse {
    status: "success" | "error";
    data?: {
        timed_lyrics?: {
            text: string;
            start_time: number;
            end_time: number;
        }[];
    };
}

export async function fetchLyrica(artist: string, song: string): Promise<SyncedLyric[] | null> {
    const params = new URLSearchParams({ artist, song, timestamps: "true" });
    const response = await fetch(`${baseUrlLyrica}?${params}`);
    if (!response.ok) return null;

    const data = await response.json() as LyricaResponse;
    const lines = data.data?.timed_lyrics;
    if (data.status !== "success" || !lines?.length) return null;

    return lines.map(line => {
        const trimmedText = line.text.trim();
        return {
            time: line.start_time / 1000,
            text: (trimmedText === "" || trimmedText === "♪") ? null : trimmedText
        };
    });
}

export async function getLyricsLyrica(track: Track): Promise<LyricsData | null> {
    const lyrics = await fetchLyrica(track.artists[0].name, track.name);
    if (!lyrics) return null;

    return {
        useLyric: Provider.Lyrica,
        lyricsVersions: {
            Lyrica: lyrics
        }
    };
}
