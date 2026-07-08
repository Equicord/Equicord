/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";
import { parseUrl } from "@utils/misc";
import { Activity } from "@vencord/discord-types";
import { ActivityFlags, ActivityStatusDisplayType } from "@vencord/discord-types/enums";
import { ApplicationAssetUtils, FluxDispatcher } from "@webpack/common";

import { settings } from "../settings";

const SOCKET_ID = "RichPresence_Navidrome";
const logger = new Logger("RichPresence:Navidrome");

let updateTimer: NodeJS.Timeout | undefined;
let abortController: AbortController | undefined;
let currentTrackId: string | undefined;
let cachedStartTimestamp: number | undefined;
let lastMinutesAgo: number | undefined;
let cachedActivity: Activity | undefined;
let cachedSettingsJSON: string | undefined;
const lastFmCache = new Map<string, string | null>();


interface NdTrack {
    id: string;
    title?: string;
    artist?: string;
    album?: string;
    year?: number;
    suffix?: string;
    bitRate?: number;
    duration?: number;
    minutesAgo?: number;
    coverArt?: string;
    username?: string;
}

function customFormat(formatStr: string | undefined, track: NdTrack): string {
    if (!formatStr) return "";
    return formatStr
        .replaceAll("{song}", track.title ?? "")
        .replaceAll("{artist}", track.artist ?? "")
        .replaceAll("{album}", track.album ?? "")
        .replaceAll("{year}", track.year ? `${track.year}` : "")
        .replaceAll("{quality}", track.suffix ? `${track.suffix.toUpperCase()}${track.bitRate ? ' ' + track.bitRate + 'kbps' : ''}` : "");
}

async function getAsset(applicationId: string, key: string): Promise<string> {
    return (await ApplicationAssetUtils.fetchAssetIds(applicationId, [key]))[0];
}

function setActivity(activity: Activity | null) {
    FluxDispatcher.dispatch({ type: "LOCAL_ACTIVITY_UPDATE", activity, socketId: SOCKET_ID });
}

async function fetchNowPlaying(signal?: AbortSignal): Promise<NdTrack | null> {
    const { nd_serverUrl, nd_username, nd_password } = settings.store;

    if (!nd_serverUrl || !nd_username || !nd_password) {
        logger.warn("Navidrome server URL, username, or password is not set.");
        return null;
    }

    try {
        const parsedUrl = parseUrl(nd_serverUrl);
        if (!parsedUrl) {
            logger.warn("Navidrome server URL is invalid.");
            return null;
        }

        const hostname = parsedUrl.hostname;
        const isIpV4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
        const isIpV6 = hostname.includes(":");
        const isLocalHost = hostname === "localhost" || hostname.endsWith(".local") || hostname.endsWith(".lan") || !hostname.includes(".");

        if (isIpV4 || isIpV6 || isLocalHost) {
            logger.warn("Navidrome server URL must use a public domain. Local IPs and hostnames are not supported.");
            return null;
        }

        const hexPassword = Array.from(new TextEncoder().encode(nd_password)).map(b => b.toString(16).padStart(2, '0')).join('');

        const baseUrl = parsedUrl.href.replace(/\/$/, "");
        const queryParams = `u=${encodeURIComponent(nd_username)}&p=enc:${hexPassword}&v=1.12.0&c=equicord-rpc&f=json`;

        const res = await fetch(`${baseUrl}/rest/getNowPlaying?${queryParams}`, { signal });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

        const data = await res.json();

        if (data["subsonic-response"]?.status === "failed") {
            logger.warn("Navidrome API error:", data["subsonic-response"].error?.message);
            return null;
        }

        const entries = data["subsonic-response"]?.nowPlaying?.entry;
        if (!entries || !Array.isArray(entries) || entries.length === 0) return null;

        const myEntry = entries.find((e: NdTrack) => e.username?.toLowerCase() === nd_username.toLowerCase());
        return myEntry ?? null;
    } catch (e: unknown) {
        if (e instanceof Error && e.name === 'AbortError') throw e;
        logger.error("Failed to fetch from Navidrome API", e);
        return null;
    }
}

function getSettingsJSON() {
    return JSON.stringify({
        nd_clientId: settings.store.nd_clientId,
        nd_showSmallImage: settings.store.nd_showSmallImage,
        nd_username: settings.store.nd_username,
        nd_password: settings.store.nd_password,
        nd_serverUrl: settings.store.nd_serverUrl,
        nd_nameString: settings.store.nd_nameString,
        nd_detailsString: settings.store.nd_detailsString,
        nd_stateString: settings.store.nd_stateString,
        nd_largeTextString: settings.store.nd_largeTextString,
        nd_activityType: settings.store.nd_activityType,
        nd_statusDisplayType: settings.store.nd_statusDisplayType,
        nd_albumArtMode: settings.store.nd_albumArtMode,
        nd_lastfmApiKey: settings.store.nd_lastfmApiKey,
        nd_showAlbum: settings.store.nd_showAlbum
    });
}

async function getActivity(signal?: AbortSignal): Promise<Activity | null> {
    const track = await fetchNowPlaying(signal);
    if (signal?.aborted) {
        const e = new Error("Aborted");
        e.name = "AbortError";
        throw e;
    }
    if (!track) return null;

    const currentSettingsJSON = getSettingsJSON();
    if (track.id === currentTrackId && cachedActivity && cachedSettingsJSON === currentSettingsJSON) {
        return cachedActivity;
    }

    const { nd_clientId, nd_showSmallImage, nd_username, nd_password, nd_serverUrl, nd_showAlbum, nd_nameString, nd_detailsString, nd_stateString, nd_largeTextString, nd_activityType, nd_statusDisplayType, nd_lastfmApiKey } = settings.store;

    const _clientId = nd_clientId?.trim();
    const appId = _clientId === "" ? "1470554657506984069" : (_clientId ?? "1470554657506984069");

    const _serverUrl = nd_serverUrl?.trim();
    const parsedExternalUrl = parseUrl(_serverUrl ?? "");
    const externalBaseUrl = parsedExternalUrl ? parsedExternalUrl.href.replace(/\/$/, "") : null;

    const durationMs = (track.duration ?? 0) * 1000;

    const trackMinutesAgo = track.minutesAgo ?? 0;

    if (track.id !== currentTrackId || !cachedStartTimestamp) {
        currentTrackId = track.id;
        const elapsedMs = trackMinutesAgo * 60 * 1000;
        cachedStartTimestamp = Date.now() - elapsedMs;
        lastMinutesAgo = trackMinutesAgo;
    } else {
        if (trackMinutesAgo < (lastMinutesAgo ?? 0) || trackMinutesAgo > (lastMinutesAgo ?? 0) + 1) {
            const elapsedMs = trackMinutesAgo * 60 * 1000;
            cachedStartTimestamp = Date.now() - elapsedMs;
        }
        lastMinutesAgo = trackMinutesAgo;
    }

    const endTimestamp = cachedStartTimestamp + durationMs;

    const isPlaying = Number(nd_activityType ?? 2) === 0;
    const nameString = !isPlaying ? customFormat(nd_nameString ? nd_nameString : "Navidrome", track) : "Navidrome";

    const detailsString = customFormat(nd_detailsString, track);
    let stateString = customFormat(nd_stateString, track);

    const assets: Activity["assets"] = {};
    if (nd_showAlbum && nd_largeTextString) {
        const largeText = customFormat(nd_largeTextString, track);
        if (largeText) {
            if (Number(nd_activityType ?? 2) === 0) {
                stateString = stateString ? `${stateString} • ${largeText}` : largeText;
            } else {
                assets.large_text = largeText;
            }
        }
    }

    const albumArtMode = settings.store.nd_albumArtMode ?? "none";
    let resolvedCoverArtUrl: string | null = null;

    if (albumArtMode === "instance" && track.coverArt && externalBaseUrl) {
        resolvedCoverArtUrl = `${externalBaseUrl}/rest/getCoverArt?id=${track.coverArt}`;
    } else if (albumArtMode === "lastfm" && track.artist) {
        const trimmedKey = nd_lastfmApiKey?.trim();
        const apiKey = trimmedKey ? trimmedKey : "feff915bf5987580c9dc354d523dc6b9";
        const cacheKey = `${track.id}:${apiKey}`;

        if (lastFmCache.has(cacheKey)) {
            resolvedCoverArtUrl = lastFmCache.get(cacheKey) ?? null;
        } else {
            try {
                const artist = encodeURIComponent(track.artist);
                let image: string | undefined;

                if (track.album) {
                    const album = encodeURIComponent(track.album);
                    const res = await fetch(`https://ws.audioscrobbler.com/2.0/?method=album.getinfo&api_key=${apiKey}&artist=${artist}&album=${album}&format=json`, { signal });
                    const json = await res.json();
                    image = json?.album?.image?.at(-1)?.["#text"];
                }

                if (!image && track.title) {
                    const title = encodeURIComponent(track.title);
                    const res = await fetch(`https://ws.audioscrobbler.com/2.0/?method=track.getinfo&api_key=${apiKey}&artist=${artist}&track=${title}&format=json`, { signal });
                    const json = await res.json();
                    image = json?.track?.album?.image?.at(-1)?.["#text"];
                }

                resolvedCoverArtUrl = image ?? null;
                lastFmCache.set(cacheKey, resolvedCoverArtUrl);
            } catch (e: unknown) {
                if (e instanceof Error && e.name === "AbortError") throw e;
                resolvedCoverArtUrl = null;
                lastFmCache.set(cacheKey, null);
            }
        }
    }

    let largeImagePromise: Promise<string>;
    if (resolvedCoverArtUrl) {
        largeImagePromise = getAsset(appId, resolvedCoverArtUrl).catch(() => "navidrome");
    } else {
        largeImagePromise = getAsset(appId, "navidrome").catch(() => "navidrome");
    }

    let smallImagePromise: Promise<string> | undefined;
    if (nd_showSmallImage) {
        smallImagePromise = getAsset(appId, "navidrome").catch(() => "navidrome");
        assets.small_text = "Navidrome";
    }

    const [largeImage, smallImage] = await Promise.all([
        largeImagePromise,
        smallImagePromise ?? Promise.resolve("")
    ]);

    assets.large_image = largeImage;
    if (nd_showSmallImage && smallImage) {
        assets.small_image = smallImage;
    }

    if (signal?.aborted) {
        const e = new Error("Aborted");
        e.name = "AbortError";
        throw e;
    }

    const activity: Activity = {
        application_id: appId,
        name: nameString ? nameString : "Navidrome",
        details: detailsString ? detailsString : undefined,
        state: stateString ? stateString : undefined,
        status_display_type: nd_statusDisplayType ? {
            "off": ActivityStatusDisplayType.NAME,
            "artist": ActivityStatusDisplayType.STATE,
            "track": ActivityStatusDisplayType.DETAILS
        }[nd_statusDisplayType as "off" | "artist" | "track"] : undefined,
        type: Number(nd_activityType ?? 2),
        flags: ActivityFlags.INSTANCE,
        timestamps: {
            start: cachedStartTimestamp,
            end: durationMs > 0 ? endTimestamp : undefined,
        },
        assets,
    };

    cachedSettingsJSON = currentSettingsJSON;
    cachedActivity = activity;
    return activity;
}

async function updatePresence() {
    try {
        const activity = await getActivity(abortController?.signal);
        setActivity(activity);
        if (!activity) {
            currentTrackId = undefined;
            cachedStartTimestamp = undefined;
            lastMinutesAgo = undefined;
            cachedActivity = undefined;
            cachedSettingsJSON = undefined;
        }
    } catch (e: unknown) {
        if (e instanceof Error && e.name === 'AbortError') return;
        logger.error("Failed to update presence", e);
        setActivity(null);
        currentTrackId = undefined;
        cachedStartTimestamp = undefined;
        lastMinutesAgo = undefined;
        cachedActivity = undefined;
        cachedSettingsJSON = undefined;
    }

    if (abortController && !abortController.signal.aborted) {
        const interval = (settings.store.nd_refreshInterval as number) ?? 10;
        updateTimer = setTimeout(updatePresence, interval * 1000);
    }
}

export function start() {
    abortController = new AbortController();
    updatePresence();
}

export function forceUpdate() {
    const currentSettingsJSON = getSettingsJSON();

    if (cachedSettingsJSON === currentSettingsJSON) {
        return;
    }

    if (abortController && !abortController.signal.aborted) {
        abortController.abort();
        clearTimeout(updateTimer);
        abortController = new AbortController();
        updatePresence();
    }
}

export function stop() {
    abortController?.abort();
    abortController = undefined;
    clearTimeout(updateTimer);
    lastFmCache.clear();
    updateTimer = undefined;
    currentTrackId = undefined;
    cachedStartTimestamp = undefined;
    lastMinutesAgo = undefined;
    cachedActivity = undefined;
    cachedSettingsJSON = undefined;
    setActivity(null);
}
