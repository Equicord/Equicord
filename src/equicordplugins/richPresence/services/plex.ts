/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";
import { formatDurationMs } from "@utils/text";
import { Activity } from "@vencord/discord-types";
import { ApplicationAssetUtils, FluxDispatcher, showToast } from "@webpack/common";

import { settings } from "../settings";

const APPLICATION_ID = "1571314810077843628";
const SOCKET_ID = "RichPresence_Plex";
const logger = new Logger("RichPresence:Plex");

interface PlexSession {
    type?: string;
    title?: string;
    grandparentTitle?: string;
    parentTitle?: string;
    originalTitle?: string;
    parentIndex?: number;
    index?: number;
    year?: number;
    duration?: number;
    viewOffset?: number;
    thumb?: string;
    parentThumb?: string;
    grandparentThumb?: string;
    User?: { title?: string; };
    Player?: { state?: string; };
}

let updateInterval: NodeJS.Timeout | undefined;
let hasShownError = false;

async function getAsset(key: string): Promise<string> {
    return (await ApplicationAssetUtils.fetchAssetIds(APPLICATION_ID, [key]))[0];
}

function setActivity(activity: Activity | null) {
    FluxDispatcher.dispatch({ type: "LOCAL_ACTIVITY_UPDATE", activity, socketId: SOCKET_ID });
}

async function fetchSession(baseUrl: string): Promise<PlexSession | null> {
    const { px_token, px_username } = settings.store;
    const res = await fetch(`${baseUrl}/status/sessions?X-Plex-Token=${encodeURIComponent(px_token)}`, {
        headers: { Accept: "application/json" }
    });
    if (!res.ok) throw `${res.status} ${res.statusText}`;

    const sessions: PlexSession[] = (await res.json()).MediaContainer?.Metadata ?? [];
    const mine = sessions.filter(s => s.User?.title?.toLowerCase() === px_username.toLowerCase());
    return mine.find(s => s.Player?.state === "playing") ?? mine[0] ?? null;
}

async function getActivity(): Promise<Activity | null> {
    const { px_serverUrl, px_token, px_username, px_privacyMode, px_showCover } = settings.store;
    if (!px_serverUrl || !px_token || !px_username) {
        if (!hasShownError) {
            logger.warn("Plex server URL, token, or username is not set.");
            showToast({ text: "Plex RPC is not configured.", variant: "critical", duration: 15000 });
            hasShownError = true;
        }
        return null;
    }

    const baseUrl = (px_serverUrl.startsWith("http") ? px_serverUrl : `https://${px_serverUrl}`).replace(/\/$/, "");
    const session = await fetchSession(baseUrl);
    if (!session) return null;

    const isPaused = session.Player?.state !== "playing";
    if (isPaused && !settings.store.px_showPausedState) return null;

    const isEpisode = session.type === "episode";
    const isTrack = session.type === "track";
    const name = session.title || "Unknown";
    const position = session.viewOffset ?? 0;
    const { duration } = session;

    let details: string;
    let state: string | undefined;
    if (px_privacyMode) {
        details = isTrack ? "Listening to music" : isEpisode ? "Watching a TV Show" : "Watching a Movie";
    } else if (isEpisode) {
        details = session.grandparentTitle || name;
        const se = `S${String(session.parentIndex ?? 0).padStart(2, "0")}E${String(session.index ?? 0).padStart(2, "0")}`;
        state = settings.store.px_showEpisodeName ? `${se} - ${name}` : se;
    } else if (isTrack) {
        details = name;
        state = session.originalTitle || session.grandparentTitle;
    } else {
        details = name;
        state = session.year ? `(${session.year})` : undefined;
    }

    if (isPaused) {
        details += " - Paused";
        const time = duration ? `${formatDurationMs(position)} / ${formatDurationMs(duration)}` : undefined;
        state = [state, time].filter(Boolean).join(" - ") || "Paused";
    }

    const thumb = isEpisode ? session.grandparentThumb : isTrack ? session.parentThumb : session.thumb;
    const imageUrl = px_showCover && !px_privacyMode && thumb
        ? `${baseUrl}${thumb}?X-Plex-Token=${encodeURIComponent(px_token)}`
        : "plex";

    return {
        application_id: APPLICATION_ID,
        name: px_privacyMode || isTrack ? "Plex" : isEpisode ? session.grandparentTitle || name : name,
        details,
        state: state || "Plex",
        assets: {
            large_image: await getAsset(imageUrl),
            large_text: px_privacyMode ? undefined : session.parentTitle,
        },
        timestamps: !isPaused && duration ? {
            start: Date.now() - position,
            end: Date.now() + duration - position,
        } : undefined,
        type: isTrack ? 2 : 3,
        flags: 1,
    };
}

async function updatePresence() {
    try {
        setActivity(await getActivity());
    } catch (e) {
        logger.error("Failed to update presence", e);
        setActivity(null);
    }
}

export function start() {
    hasShownError = false;
    updatePresence();
    updateInterval = setInterval(updatePresence, 10000);
}

export function stop() {
    clearInterval(updateInterval);
    updateInterval = undefined;
    setActivity(null);
}
