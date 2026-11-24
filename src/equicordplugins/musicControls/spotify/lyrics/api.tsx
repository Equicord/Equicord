/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DataStore } from "@api/index";
import { Track } from "@equicordplugins/musicControls/spotify/SpotifyStore";

import { getLyricsLyrica } from "./providers/lyricaAPI";
import { LyricsData, Provider, SyncedLyric } from "./providers/types";

const LyricsCacheKey = "MusicControlsLyricsCache";

const nullLyricCache = new Set<string>();

export const lyricFetchers = {
    [Provider.Lyrica]: getLyricsLyrica,
};

export const providers = Object.keys(lyricFetchers) as Provider[];

export async function getLyrics(track: Track | null): Promise<LyricsData | null> {
    if (!track || !track.id) return null;

    const cacheKey = track.id;
    const cached = await DataStore.get(LyricsCacheKey) as Record<string, LyricsData | null>;

    if (cached?.[cacheKey]) {
        return cached[cacheKey];
    }

    if (nullLyricCache.has(cacheKey)) return null;

    const lyricsInfo = await getLyricsLyrica(track);

    if (lyricsInfo) {
        await DataStore.set(LyricsCacheKey, { ...cached, [cacheKey]: lyricsInfo });
        return lyricsInfo;
    }

    nullLyricCache.add(cacheKey);
    return null;
}

export async function clearLyricsCache() {
    nullLyricCache.clear();
    await DataStore.set(LyricsCacheKey, {});
}

export async function getLyricsCount(): Promise<number> {
    const cache = await DataStore.get(LyricsCacheKey) as Record<string, LyricsData | null>;
    return Object.keys(cache ?? {}).length;
}

export async function updateLyrics(trackId: string, newLyrics: SyncedLyric[], provider: Provider) {
    const cache = await DataStore.get(LyricsCacheKey) as Record<string, LyricsData | null>;
    const current = cache[trackId];

    await DataStore.set(LyricsCacheKey,
        {
            ...cache, [trackId]: {
                ...current,
                useLyric: provider,
                lyricsVersions: {
                    ...current?.lyricsVersions,
                    [provider]: newLyrics
                }
            }
        }
    );
}

export async function removeTranslations() {
    const cache = await DataStore.get(LyricsCacheKey) as Record<string, LyricsData | null>;
    const newCache = {} as Record<string, LyricsData | null>;

    for (const [trackId, trackData] of Object.entries(cache)) {
        const { Translated, ...lyricsVersions } = trackData?.lyricsVersions || {};
        newCache[trackId] = { lyricsVersions, useLyric: Provider.Lyrica };
    }

    await DataStore.set(LyricsCacheKey, newCache);
}
