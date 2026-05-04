/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { RendererSettings } from "@main/settings";

interface SongLinkEntity {
    title?: string;
    artistName?: string;
}

interface SongLinkResponse {
    entitiesByUniqueId: Record<string, SongLinkEntity>;
    linksByPlatform: Record<string, { url: string }>;
}

interface SongLinkResult {
    title?: string;
    artist?: string;
    linksByPlatform: Record<string, { url: string }>;
}

interface ITunesResult {
    results: { trackViewUrl?: string }[];
}

/**
 * Scrape YouTube search results to find the first video ID for a query.
 * Aborts after 3 seconds to avoid blocking the message send.
 */
async function searchYouTube(query: string): Promise<string | null> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);

        const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
        const res = await fetch(url, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            },
            signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) return null;
        const html = await res.text();
        const match = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
        return match?.[1] ?? null;
    } catch {
        return null;
    }
}

/**
 * Use the free iTunes Search API to find a direct Apple Music link.
 * Aborts after 2 seconds.
 */
async function searchAppleMusic(query: string): Promise<string | null> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);

        const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=1`;
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        if (!res.ok) return null;
        const data: ITunesResult = await res.json();
        return data.results[0]?.trackViewUrl ?? null;
    } catch {
        return null;
    }
}

export async function getSongLinks(
    _: unknown,
    trackUrl: string,
): Promise<SongLinkResult> {
    const pluginSettings = RendererSettings.store.plugins?.MusicLinker;
    const url = new URL("https://api.song.link/v1-alpha.1/links");
    url.searchParams.set("url", trackUrl);
    url.searchParams.set("userCountry", pluginSettings?.userCountry ?? "FR");

    const response = await fetch(url.toString());
    if (!response.ok) {
        throw new Error(
            `song.link API returned ${response.status}${response.status === 429 ? " (rate limited)" : ""}`,
        );
    }

    const raw: SongLinkResponse = await response.json();

    const [, entry] =
        Object.entries(raw.entitiesByUniqueId).find(
            ([key]) => !key.includes("YOUTUBE"),
        ) ?? [];

    // Build the platform links from the API response
    const linksByPlatform: Record<string, { url: string }> = Object.fromEntries(
        Object.entries(raw.linksByPlatform).map(([name, data]) => [
            name,
            { url: data.url },
        ]),
    );

    // Only enrich platforms that the user has enabled AND are missing from the API
    if (entry?.title && entry?.artistName) {
        const searchQuery = `${entry.artistName} ${entry.title}`;
        const enrichments: Promise<void>[] = [];

        // YouTube + YouTube Music — only scrape if at least one is enabled and missing
        const needsYT =
            (pluginSettings?.enableYoutube !== false &&
                !linksByPlatform.youtube) ||
            (pluginSettings?.enableYoutubeMusic !== false &&
                !linksByPlatform.youtubeMusic);

        if (needsYT) {
            enrichments.push(
                searchYouTube(searchQuery).then((videoId) => {
                    if (videoId) {
                        if (!linksByPlatform.youtube) {
                            linksByPlatform.youtube = {
                                url: `https://www.youtube.com/watch?v=${videoId}`,
                            };
                        }
                        if (!linksByPlatform.youtubeMusic) {
                            linksByPlatform.youtubeMusic = {
                                url: `https://music.youtube.com/watch?v=${videoId}`,
                            };
                        }
                    }
                }),
            );
        }

        // Apple Music — only call iTunes API if enabled and missing
        if (
            pluginSettings?.enableAppleMusic !== false &&
            !linksByPlatform.appleMusic
        ) {
            enrichments.push(
                searchAppleMusic(searchQuery).then((appleMusicUrl) => {
                    if (appleMusicUrl) {
                        linksByPlatform.appleMusic = { url: appleMusicUrl };
                    }
                }),
            );
        }

        if (enrichments.length) {
            await Promise.allSettled(enrichments);
        }

        // Search fallbacks for missing platforms
        const queryEncoded = encodeURIComponent(searchQuery);

        if (
            pluginSettings?.enableSpotify !== false &&
            !linksByPlatform.spotify
        ) {
            linksByPlatform.spotify = {
                url: `https://open.spotify.com/search/${queryEncoded}`,
            };
        }
        if (pluginSettings?.enableDeezer !== false && !linksByPlatform.deezer) {
            linksByPlatform.deezer = {
                url: `https://www.deezer.com/search/${queryEncoded}`,
            };
        }
        if (pluginSettings?.enableTidal !== false && !linksByPlatform.tidal) {
            linksByPlatform.tidal = {
                url: `https://listen.tidal.com/search?q=${queryEncoded}`,
            };
        }
        if (
            pluginSettings?.enableAppleMusic !== false &&
            !linksByPlatform.appleMusic
        ) {
            linksByPlatform.appleMusic = {
                url: `https://music.apple.com/search?term=${queryEncoded}`,
            };
        }
        if (
            pluginSettings?.enableYoutube !== false &&
            !linksByPlatform.youtube
        ) {
            linksByPlatform.youtube = {
                url: `https://www.youtube.com/results?search_query=${queryEncoded}`,
            };
        }
        if (
            pluginSettings?.enableYoutubeMusic !== false &&
            !linksByPlatform.youtubeMusic
        ) {
            linksByPlatform.youtubeMusic = {
                url: `https://music.youtube.com/search?q=${queryEncoded}`,
            };
        }
        if (pluginSettings?.enableSoundcloud && !linksByPlatform.soundcloud) {
            linksByPlatform.soundcloud = {
                url: `https://soundcloud.com/search?q=${queryEncoded}`,
            };
        }
    }

    return {
        title: entry?.title,
        artist: entry?.artistName,
        linksByPlatform,
    };
}
