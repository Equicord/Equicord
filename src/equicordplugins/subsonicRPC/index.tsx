/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Paragraph } from "@components/Paragraph";
import { EquicordDevs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { Activity, ActivityAssets } from "@vencord/discord-types";
import { ActivityFlags, ActivityType } from "@vencord/discord-types/enums";
import { ApplicationAssetUtils, AuthenticationStore, FluxDispatcher, PresenceStore } from "@webpack/common";

interface SubsonicEntry {
    id: string;
    title: string;
    artist?: string;
    album?: string;
    duration?: number;
    username: string;
    minutesAgo: number;
}

const enum NameFormat {
    StatusName = "status-name",
    ArtistFirst = "artist-first",
    SongFirst = "song-first",
    ArtistOnly = "artist",
    SongOnly = "song",
    AlbumName = "album",
}

const DISCORD_APP_ID = "1478132680662057113";
const SOCKET_ID = "SubsonicRPC";

const logger = new Logger("SubsonicRPC");

const MB_USER_AGENT = "EquicordSubsonicRPC/1.0 (https://github.com/Equicord/Equicord)";

let updateInterval: NodeJS.Timeout | undefined;
let currentSongId = "";
let currentStart = 0;
const coverArtCache = new Map<string, string | null>();

async function fetchCoverArtUrl(artist: string, album: string): Promise<string | null> {
    try {
        const mbRes = await fetch(
            `https://musicbrainz.org/ws/2/release/?query=release:${encodeURIComponent(album)}%20AND%20artist:${encodeURIComponent(artist)}&fmt=json&limit=1`,
            { headers: { "User-Agent": MB_USER_AGENT } }
        );
        if (!mbRes.ok) return null;

        const mbJson = await mbRes.json();
        const { releases } = mbJson;
        if (!releases?.length) return null;

        const releaseGroupId = releases[0]["release-group"]?.id;
        if (!releaseGroupId) return null;

        const caaRes = await fetch(`https://coverartarchive.org/release-group/${releaseGroupId}`);
        if (!caaRes.ok) return null;

        const image = (await caaRes.json()).images?.[0];
        if (!image) return null;

        return image.thumbnails?.["500"] ?? image.thumbnails?.large ?? image.image ?? null;
    } catch (e) {
        logger.error("Failed to fetch cover art", e);
        return null;
    }
}

async function getApplicationAsset(key: string): Promise<string> {
    return (await ApplicationAssetUtils.fetchAssetIds(DISCORD_APP_ID, [key]))[0];
}

function setActivity(activity: Activity | null) {
    FluxDispatcher.dispatch({
        type: "LOCAL_ACTIVITY_UPDATE",
        activity,
        socketId: SOCKET_ID,
    });
}

function buildAuthParams(username: string, password: string): string {
    const hexPass = Array.from(new TextEncoder().encode(password), b => b.toString(16).padStart(2, "0")).join("");
    return `u=${encodeURIComponent(username)}&p=enc:${hexPass}&v=1.16.1&c=EquicordSubsonicRPC&f=json`;
}

const settings = definePluginSettings({
    serverUrl: {
        description: "Subsonic server URL (e.g. https://music.example.com).",
        type: OptionType.STRING,
    },
    username: {
        description: "Subsonic username.",
        type: OptionType.STRING,
    },
    password: {
        description: "Subsonic password.",
        type: OptionType.STRING,
    },
    hideWithSpotify: {
        description: "Hide presence if a listening type presence is already active.",
        type: OptionType.BOOLEAN,
        default: true,
    },
    hideWithActivity: {
        description: "Hide presence if any other presence is active.",
        type: OptionType.BOOLEAN,
        default: false,
    },
    useListeningStatus: {
        description: 'Show "Listening to" status instead of "Playing".',
        type: OptionType.BOOLEAN,
        default: true,
    },
    statusName: {
        description: "Custom status text.",
        type: OptionType.STRING,
        default: "some music",
    },
    nameFormat: {
        description: "Show name of song and artist in status name.",
        type: OptionType.SELECT,
        options: [
            { label: "Use custom status name", value: NameFormat.StatusName, default: true },
            { label: "Use format 'artist - song'", value: NameFormat.ArtistFirst },
            { label: "Use format 'song - artist'", value: NameFormat.SongFirst },
            { label: "Use artist name only", value: NameFormat.ArtistOnly },
            { label: "Use song name only", value: NameFormat.SongOnly },
            { label: "Use album name (falls back to custom status text if song has no album)", value: NameFormat.AlbumName },
        ],
    },
    useTimeBar: {
        description: "Show progress bar using track duration.",
        type: OptionType.BOOLEAN,
        default: true,
    },
    showServerLogo: {
        description: "Show the Navidrome logo as the small icon.",
        type: OptionType.BOOLEAN,
        default: true,
    },
    missingArt: {
        description: "Fallback when no album art is available.",
        type: OptionType.SELECT,
        options: [
            { label: "Use Navidrome logo", value: "navidromeLogo", default: true },
            { label: "Use generic placeholder", value: "placeholder" },
        ],
    },
});

export default definePlugin({
    name: "SubsonicRPC",
    description: "Rich presence for Navidrome and other Subsonic-compatible music servers.",
    authors: [EquicordDevs.saber],

    settings,

    settingsAboutComponent: () => (
        <Paragraph>
            Enter your Subsonic server URL and login credentials.
        </Paragraph>
    ),

    start() {
        this.updatePresence();
        updateInterval = setInterval(() => { this.updatePresence(); }, 16000);
    },

    stop() {
        clearInterval(updateInterval);
        updateInterval = undefined;
        coverArtCache.clear();
        setActivity(null);
    },

    async fetchNowPlaying(): Promise<SubsonicEntry | null> {
        const { serverUrl, username, password } = settings.store;
        if (!serverUrl || !username || !password) return null;

        try {
            const base = serverUrl.replace(/\/$/, "");
            const auth = buildAuthParams(username, password);
            const res = await fetch(`${base}/rest/getNowPlaying?${auth}`);
            if (!res.ok) throw `${res.status} ${res.statusText}`;

            const json = await res.json();
            const root = json["subsonic-response"];
            if (root?.status !== "ok") {
                logger.error("Subsonic API error", root?.error?.message ?? "Unknown error");
                return null;
            }

            const raw = root.nowPlaying?.entry;
            const entries: SubsonicEntry[] = !raw ? [] : Array.isArray(raw) ? raw : [raw];
            return entries.find(e => e.username === username) ?? null;
        } catch (e) {
            logger.error("Failed to query Subsonic API", e);
            return null;
        }
    },

    async updatePresence() {
        setActivity(await this.getActivity());
    },

    async getActivity(): Promise<Activity | null> {
        const myId = AuthenticationStore.getId();

        if (settings.store.hideWithActivity) {
            if (PresenceStore.getActivities(myId).some(a => a.application_id !== DISCORD_APP_ID && a.type !== ActivityType.CUSTOM_STATUS))
                return null;
        }

        if (settings.store.hideWithSpotify) {
            if (PresenceStore.getActivities(myId).some(a => a.type === ActivityType.LISTENING && a.application_id !== DISCORD_APP_ID))
                return null;
        }

        const entry = await this.fetchNowPlaying();
        if (!entry) return null;

        if (entry.id !== currentSongId) {
            currentSongId = entry.id;
            currentStart = Date.now() - entry.minutesAgo * 60_000;
        }

        if (!coverArtCache.has(entry.id)) {
            const url = entry.artist && entry.album
                ? await fetchCoverArtUrl(entry.artist, entry.album)
                : null;
            coverArtCache.set(entry.id, url);
        }

        const coverArtUrl = coverArtCache.get(entry.id) ?? null;
        const largeImage = coverArtUrl
            ? await getApplicationAsset(coverArtUrl)
            : await getApplicationAsset(settings.store.missingArt === "placeholder" ? "placeholder" : "navidrome");

        const assets: ActivityAssets = {
            large_image: largeImage,
            large_text: entry.album,
            ...(settings.store.showServerLogo && {
                small_image: await getApplicationAsset("navidrome"),
                small_text: "Navidrome",
            }),
        };

        const statusName = (() => {
            switch (settings.store.nameFormat) {
                case NameFormat.ArtistFirst: return `${entry.artist ?? "Unknown"} - ${entry.title}`;
                case NameFormat.SongFirst: return `${entry.title} - ${entry.artist ?? "Unknown"}`;
                case NameFormat.ArtistOnly: return entry.artist ?? "Unknown";
                case NameFormat.SongOnly: return entry.title;
                case NameFormat.AlbumName: return entry.album ?? settings.store.statusName;
                default: return settings.store.statusName ?? "some music";
            }
        })();

        return {
            application_id: DISCORD_APP_ID,
            name: statusName,
            details: entry.title,
            state: entry.artist,
            assets,
            timestamps: settings.store.useTimeBar && entry.duration
                ? { start: currentStart, end: currentStart + entry.duration * 1000 }
                : undefined,
            type: settings.store.useListeningStatus ? ActivityType.LISTENING : ActivityType.PLAYING,
            flags: ActivityFlags.INSTANCE,
        };
    },
});
