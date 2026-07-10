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
import md5 from "md5";

import { settings } from "../settings";

function md5Hex(str: string): string {
    return md5(str);
}

const SOCKET_ID = "RichPresence_Navidrome";
const logger = new Logger("RichPresence:Navidrome");

let updateTimer: NodeJS.Timeout | undefined;
let abortController: AbortController | undefined;
let currentTrackId: string | undefined;
let cachedStartTimestamp: number | undefined;
let cachedPauseTimestamp: number | undefined;
let cachedTrackState: string | undefined;
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
    state?: string;
    positionMs?: number;
    playbackRate?: number;
}

function customFormat(formatStr: string | undefined, track: NdTrack): string {
    if (!formatStr) return "";
    return formatStr
        .replaceAll("{song}", track.title ?? "")
        .replaceAll("{artist}", track.artist ?? "")
        .replaceAll("{album}", track.album ?? "")
        .replaceAll("{year}", track.year ? `${track.year}` : "")
        .replaceAll("{quality}", track.suffix ? `${track.suffix.toUpperCase()}${track.bitRate ? " " + track.bitRate + "kbps" : ""}` : "");
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

        if (parsedUrl.protocol !== "https:") {
            logger.warn("Navidrome server URL must use HTTPS.");
            return null;
        }

        const salt = Math.random().toString(36).substring(2, 8);
        const token = md5Hex((nd_password ?? "") + salt);

        const baseUrl = parsedUrl.href.replace(/\/$/, "");
        const queryParams = `u=${encodeURIComponent(nd_username)}&t=${token}&s=${salt}&v=1.12.0&c=equicord-rpc&f=json`;

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
        if (e instanceof Error && e.name === "AbortError") throw e;
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
        nd_showAlbum: settings.store.nd_showAlbum,
        nd_hideOnPause: settings.store.nd_hideOnPause
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

    const isPaused = track.state?.toLowerCase() === "paused";

    if (track.id === currentTrackId && cachedActivity && cachedSettingsJSON === currentSettingsJSON) {
        let drift = false;
        if (track.positionMs !== undefined && !isPaused && cachedStartTimestamp) {
            const expectedPosition = Date.now() - cachedStartTimestamp;
            if (Math.abs(expectedPosition - track.positionMs) > 2000) drift = true;
        }
        if (track.state === cachedTrackState && (track.minutesAgo ?? 0) === (lastMinutesAgo ?? 0) && !drift) {
            return cachedActivity;
        }
    }

    const { nd_clientId, nd_showSmallImage, nd_serverUrl, nd_showAlbum, nd_nameString, nd_detailsString, nd_stateString, nd_largeTextString, nd_activityType, nd_statusDisplayType, nd_lastfmApiKey, nd_hideOnPause } = settings.store;

    if (isPaused && nd_hideOnPause) {
        cachedPauseTimestamp = undefined;
        return null;
    }

    const _clientId = nd_clientId?.trim();
    const appId = _clientId === "" ? "1470554657506984069" : (_clientId ?? "1470554657506984069");

    const _serverUrl = nd_serverUrl?.trim();
    const parsedExternalUrl = parseUrl(_serverUrl ?? "");
    const externalBaseUrl = parsedExternalUrl ? parsedExternalUrl.href.replace(/\/$/, "") : null;

    const durationMs = (track.duration ?? 0) * 1000;

    const trackMinutesAgo = track.minutesAgo ?? 0;

    if (track.id !== currentTrackId || !cachedStartTimestamp) {
        currentTrackId = track.id;
        const elapsedMs = track.positionMs ?? (trackMinutesAgo * 60 * 1000);
        cachedStartTimestamp = Date.now() - elapsedMs;
        lastMinutesAgo = trackMinutesAgo;
    } else {
        if (track.positionMs !== undefined) {
            if (!isPaused) {
                const expectedPosition = Date.now() - cachedStartTimestamp;
                if (Math.abs(expectedPosition - track.positionMs) > 2000) {
                    cachedStartTimestamp = Date.now() - track.positionMs;
                }
            }
        } else {
            if (trackMinutesAgo < (lastMinutesAgo ?? 0) || trackMinutesAgo > (lastMinutesAgo ?? 0) + 1) {
                const elapsedMs = trackMinutesAgo * 60 * 1000;
                cachedStartTimestamp = Date.now() - elapsedMs;
            }
        }
        lastMinutesAgo = trackMinutesAgo;
    }

    if (isPaused) {
        if (!cachedPauseTimestamp) {
            cachedPauseTimestamp = Date.now();
        }
    } else {
        cachedPauseTimestamp = undefined;
    }

    const endTimestamp = cachedStartTimestamp + durationMs;

    if (!isPaused && durationMs > 0 && Date.now() >= endTimestamp) {
        return null;
    }

    const isPlaying = Number(nd_activityType ?? 2) === 0;
    const nameString = !isPlaying ? customFormat(nd_nameString || "Navidrome", track) : "Navidrome";

    const detailsString = customFormat(nd_detailsString, track);
    let stateString = customFormat(nd_stateString, track);

    if (isPaused) {
        stateString = stateString ? `${stateString} (Paused)` : "Paused";
    }

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
        const { nd_username, nd_password } = settings.store;
        const salt = Math.random().toString(36).substring(2, 8);
        const token = md5Hex((nd_password ?? "") + salt);
        resolvedCoverArtUrl = `${externalBaseUrl}/rest/getCoverArt?id=${encodeURIComponent(track.coverArt)}&u=${encodeURIComponent(nd_username ?? "")}&t=${token}&s=${salt}&v=1.12.0&c=equicord-rpc`;
    } else if (albumArtMode === "lastfm" && track.artist) {
        const trimmedKey = nd_lastfmApiKey?.trim();
        const apiKey = trimmedKey || "feff915bf5987580c9dc354d523dc6b9";
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
        name: nameString || "Navidrome",
        details: detailsString || undefined,
        state: stateString || undefined,
        status_display_type: nd_statusDisplayType ? {
            "off": ActivityStatusDisplayType.NAME,
            "artist": ActivityStatusDisplayType.STATE,
            "track": ActivityStatusDisplayType.DETAILS
        }[nd_statusDisplayType as "off" | "artist" | "track"] : undefined,
        type: (isPaused && !nd_hideOnPause) ? 0 : Number(nd_activityType ?? 2),
        flags: ActivityFlags.INSTANCE,
        timestamps: isPaused && !nd_hideOnPause ? {
            start: cachedPauseTimestamp,
        } : {
            start: cachedStartTimestamp,
            end: durationMs > 0 ? endTimestamp : undefined,
        },
        assets,
    };

    cachedSettingsJSON = currentSettingsJSON;
    cachedActivity = activity;
    cachedTrackState = track.state;
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
            cachedTrackState = undefined;
            cachedPauseTimestamp = undefined;
        }
    } catch (e: unknown) {
        if (e instanceof Error && e.name === "AbortError") return;
        logger.error("Failed to update presence", e);
        setActivity(null);
        currentTrackId = undefined;
        cachedStartTimestamp = undefined;
        cachedPauseTimestamp = undefined;
        lastMinutesAgo = undefined;
        cachedActivity = undefined;
        cachedSettingsJSON = undefined;
        cachedTrackState = undefined;
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
    cachedPauseTimestamp = undefined;
    lastMinutesAgo = undefined;
    cachedActivity = undefined;
    cachedSettingsJSON = undefined;
    cachedTrackState = undefined;
    setActivity(null);
}
