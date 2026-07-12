/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IpcMainInvokeEvent } from "electron";

import type { GrTrackData } from "./types/gensokyoRadio";
import type { StorytellerBook } from "./types/storyteller";

export async function fetchTrackData(): Promise<GrTrackData | null> {
    const song = await (await fetch("https://gensokyoradio.net/api/station/playing/")).json();

    return {
        title: song.SONGINFO.TITLE,
        album: song.SONGINFO.ALBUM,
        artist: song.SONGINFO.ARTIST,
        position: song.SONGTIMES.SONGSTART,
        duration: song.SONGTIMES.SONGEND,
        artwork: song.MISC.ALBUMART ? `https://gensokyoradio.net/images/albums/500/${song.MISC.ALBUMART}` : "",
    };
}

export async function storytellerGetToken(_event: IpcMainInvokeEvent, serverUrl: string, usernameOrEmail: string, password: string): Promise<string | null> {
    try {
        const baseUrl = serverUrl.replace(/\/$/, "");
        const body = `usernameOrEmail=${encodeURIComponent(usernameOrEmail)}&password=${encodeURIComponent(password)}`;
        const res = await fetch(`${baseUrl}/api/v2/token`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body,
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.access_token ?? null;
    } catch {
        return null;
    }
}

export async function storytellerFetchBooks(_event: IpcMainInvokeEvent, serverUrl: string, token: string): Promise<StorytellerBook[] | null> {
    try {
        const baseUrl = serverUrl.replace(/\/$/, "");
        const res = await fetch(`${baseUrl}/api/v2/books`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}
