/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";
import { Activity } from "@vencord/discord-types";
import { ActivityType, ActivityFlags } from "@vencord/discord-types/enums";
import { ApplicationAssetUtils, FluxDispatcher } from "@webpack/common";

import { settings } from "../settings";

const SOCKET_ID = "RichPresence_Navidrome";
const logger = new Logger("RichPresence:Navidrome");

let updateInterval: NodeJS.Timeout | undefined;
let abortController: AbortController | undefined;
let currentTrackId: string | undefined;
let cachedStartTimestamp: number | undefined;
let cachedActivity: Activity | undefined;

function md5(string: string): string {
    function md5cycle(x: number[], k: number[]) {
        let a = x[0], b = x[1], c = x[2], d = x[3];
        a = ff(a, b, c, d, k[0], 7, -680876936); d = ff(d, a, b, c, k[1], 12, -389564586); c = ff(c, d, a, b, k[2], 17, 606105819); b = ff(b, c, d, a, k[3], 22, -1044525330);
        a = ff(a, b, c, d, k[4], 7, -176418897); d = ff(d, a, b, c, k[5], 12, 1200080426); c = ff(c, d, a, b, k[6], 17, -1473231341); b = ff(b, c, d, a, k[7], 22, -45705983);
        a = ff(a, b, c, d, k[8], 7, 1770035416); d = ff(d, a, b, c, k[9], 12, -1958414417); c = ff(c, d, a, b, k[10], 17, -42063); b = ff(b, c, d, a, k[11], 22, -1990404162);
        a = ff(a, b, c, d, k[12], 7, 1804603682); d = ff(d, a, b, c, k[13], 12, -40341101); c = ff(c, d, a, b, k[14], 17, -1502002290); b = ff(b, c, d, a, k[15], 22, 1236535329);
        a = gg(a, b, c, d, k[1], 5, -165796510); d = gg(d, a, b, c, k[6], 9, -1069501632); c = gg(c, d, a, b, k[11], 14, 643717713); b = gg(b, c, d, a, k[0], 20, -373897302);
        a = gg(a, b, c, d, k[5], 5, -701558691); d = gg(d, a, b, c, k[10], 9, 38016083); c = gg(c, d, a, b, k[15], 14, -660478335); b = gg(b, c, d, a, k[4], 20, -405537848);
        a = gg(a, b, c, d, k[9], 5, 568446438); d = gg(d, a, b, c, k[14], 9, -1019803690); c = gg(c, d, a, b, k[3], 14, -187363961); b = gg(b, c, d, a, k[8], 20, 1163531501);
        a = gg(a, b, c, d, k[13], 5, -1444681467); d = gg(d, a, b, c, k[2], 9, -51403784); c = gg(c, d, a, b, k[7], 14, 1735328473); b = gg(b, c, d, a, k[12], 20, -1926607734);
        a = hh(a, b, c, d, k[5], 4, -378558); d = hh(d, a, b, c, k[8], 11, -2022574463); c = hh(c, d, a, b, k[11], 16, 1839030562); b = hh(b, c, d, a, k[14], 23, -35309556);
        a = hh(a, b, c, d, k[1], 4, -1530992060); d = hh(d, a, b, c, k[4], 11, 1272893353); c = hh(c, d, a, b, k[7], 16, -155497632); b = hh(b, c, d, a, k[10], 23, -1094730640);
        a = hh(a, b, c, d, k[13], 4, 681279174); d = hh(d, a, b, c, k[0], 11, -358537222); c = hh(c, d, a, b, k[3], 16, -722521979); b = hh(b, c, d, a, k[6], 23, 76029189);
        a = hh(a, b, c, d, k[9], 4, -640364487); d = hh(d, a, b, c, k[12], 11, -421815835); c = hh(c, d, a, b, k[15], 16, 530742520); b = hh(b, c, d, a, k[2], 23, -995338651);
        a = ii(a, b, c, d, k[0], 6, -198630844); d = ii(d, a, b, c, k[7], 10, 1126891415); c = ii(c, d, a, b, k[14], 15, -1416354905); b = ii(b, c, d, a, k[5], 21, -57434055);
        a = ii(a, b, c, d, k[12], 6, 1700485571); d = ii(d, a, b, c, k[3], 10, -1894986606); c = ii(c, d, a, b, k[10], 15, -1051523); b = ii(b, c, d, a, k[1], 21, -2054922799);
        a = ii(a, b, c, d, k[8], 6, 1873313359); d = ii(d, a, b, c, k[15], 10, -30611744); c = ii(c, d, a, b, k[6], 15, -1560198380); b = ii(b, c, d, a, k[13], 21, 1309151649);
        a = ii(a, b, c, d, k[4], 6, -145523070); d = ii(d, a, b, c, k[11], 10, -1120210379); c = ii(c, d, a, b, k[2], 15, 718787259); b = ii(b, c, d, a, k[9], 21, -343485551);
        x[0] = add32(a, x[0]); x[1] = add32(b, x[1]); x[2] = add32(c, x[2]); x[3] = add32(d, x[3]);
    }
    function cmn(q: number, a: number, b: number, x: number, s: number, t: number) { a = add32(add32(a, q), add32(x, t)); return add32((a << s) | (a >>> (32 - s)), b); }
    function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn((b & c) | ((~b) & d), a, b, x, s, t); }
    function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn((b & d) | (c & (~d)), a, b, x, s, t); }
    function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn(b ^ c ^ d, a, b, x, s, t); }
    function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn(c ^ (b | (~d)), a, b, x, s, t); }
    function add32(a: number, b: number) { return (a + b) & 0xFFFFFFFF; }
    let n = string.length, state = [1732584193, -271733879, -1732584194, 271733878], i;
    for (i = 64; i <= string.length; i += 64) {
        md5cycle(state, md5blk(string.substring(i - 64, i)));
    }
    string = string.substring(i - 64);
    let tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (i = 0; i < string.length; i++) tail[i >> 2] |= string.charCodeAt(i) << ((i % 4) << 3);
    tail[i >> 2] |= 0x80 << ((i % 4) << 3);
    if (i > 55) { md5cycle(state, tail); for (i = 0; i < 16; i++) tail[i] = 0; }
    tail[14] = n * 8; md5cycle(state, tail);
    return rhex(state);
    function md5blk(s: string) {
        let md5blks: number[] = [], i;
        for (i = 0; i < 64; i += 4) { md5blks[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) + (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24); }
        return md5blks;
    }
    function rhex(n: number[]) {
        let s = "", j = 0;
        for (; j < 4; j++) s += hex_chr((n[j] >> 4) & 0x0F) + hex_chr(n[j] & 0x0F) + hex_chr((n[j] >> 12) & 0x0F) + hex_chr((n[j] >> 8) & 0x0F) + hex_chr((n[j] >> 20) & 0x0F) + hex_chr((n[j] >> 16) & 0x0F) + hex_chr((n[j] >> 28) & 0x0F) + hex_chr((n[j] >> 24) & 0x0F);
        return s;
    }
    function hex_chr(n: number) { return "0123456789abcdef".charAt(n); }
}

async function getAsset(applicationId: string, key: string): Promise<string> {
    return (await ApplicationAssetUtils.fetchAssetIds(applicationId, [key]))[0];
}

function setActivity(activity: Activity | null) {
    FluxDispatcher.dispatch({ type: "LOCAL_ACTIVITY_UPDATE", activity, socketId: SOCKET_ID });
}

async function fetchNowPlaying(signal?: AbortSignal) {
    const { nd_serverUrl, nd_username, nd_password } = settings.store;

    if (!nd_serverUrl || !nd_username || !nd_password) {
        logger.warn("Navidrome server URL, username, or password is not set.");
        return null;
    }

    try {
        const salt = Math.random().toString(36).substring(2, 15);
        const hash = md5(nd_password + salt);
        const baseUrl = nd_serverUrl.replace(/\/$/, "");
        const queryParams = `u=${encodeURIComponent(nd_username as string)}&t=${hash}&s=${salt}&v=1.12.0&c=equicord-rpc&f=json`;

        const res = await fetch(`${baseUrl}/rest/getNowPlaying?${queryParams}`, { signal });
        if (!res.ok) throw `${res.status} ${res.statusText}`;

        const data = await res.json();

        if (data["subsonic-response"]?.status === "failed") {
            logger.warn("Navidrome API error:", data["subsonic-response"].error?.message);
            return null;
        }

        const entries = data["subsonic-response"]?.nowPlaying?.entry;
        if (!entries || entries.length === 0) return null;

        return entries[0];
    } catch (e: any) {
        if (e.name === 'AbortError') throw e;
        logger.error("Failed to fetch from Navidrome API", e);
        return null;
    }
}

async function getActivity(signal?: AbortSignal): Promise<Activity | null> {
    const track = await fetchNowPlaying(signal);
    if (!track) return null;

    if (track.id === currentTrackId && cachedActivity) {
        return cachedActivity;
    }

    const { nd_clientId, nd_publicUrl, nd_showSmallImage, nd_username, nd_password, nd_serverUrl } = settings.store;

    const _clientId = (nd_clientId as string)?.trim();
    const appId = _clientId === "" ? "1470554657506984069" : (_clientId ?? "1470554657506984069");

    const _publicUrl = (nd_publicUrl as string)?.replace(/\/$/, "");
    const _serverUrl = (nd_serverUrl as string)?.replace(/\/$/, "");
    const externalBaseUrl = _publicUrl === "" ? _serverUrl : (_publicUrl ?? _serverUrl);

    const durationMs = (track.duration ?? 0) * 1000;
    
    if (track.id !== currentTrackId || !cachedStartTimestamp) {
        currentTrackId = track.id;
        const minutesAgo = track.minutesAgo ?? 0;
        const elapsedMs = minutesAgo * 60 * 1000;
        cachedStartTimestamp = Date.now() - elapsedMs;
    }

    const endTimestamp = cachedStartTimestamp + durationMs;

    const stateFormat = settings.store.nd_stateFormat ?? "artist";
    let stateString = "Navidrome";
    
    if (stateFormat === "artist" && track.artist) {
        stateString = track.artist;
    } else if (stateFormat === "year" && track.year) {
        stateString = `${track.year}`;
    } else if (stateFormat === "quality" && track.suffix) {
        stateString = `${track.suffix.toUpperCase()}${track.bitRate ? ' ' + track.bitRate + 'kbps' : ''}`;
    } else if (stateFormat === "both") {
        const yearStr = track.year ? `${track.year}` : "";
        const qualStr = track.suffix ? `${track.suffix.toUpperCase()}${track.bitRate ? ' ' + track.bitRate + 'kbps' : ''}` : "";
        const joined = [yearStr, qualStr].filter(Boolean).join(" • ");
        stateString = joined === "" ? "Navidrome" : joined;
    }

    const listeningFormat = settings.store.nd_listeningFormat ?? "navidrome";
    let nameString = "Navidrome";
    if (listeningFormat === "artist") nameString = track.artist ?? "Unknown Artist";
    if (listeningFormat === "song") nameString = track.title ?? "Unknown Song";
    if (listeningFormat === "album") nameString = track.album ?? "Unknown Album";

    const assets: Activity["assets"] = {
        large_text: track.album ?? track.title,
    };

    if (track.coverArt && externalBaseUrl) {
        const salt = Math.random().toString(36).substring(2, 15);
        const hash = md5(nd_password + salt);
        const localCoverArtUrl = `${externalBaseUrl}/rest/getCoverArt?id=${track.coverArt}&u=${encodeURIComponent(nd_username as string)}&t=${hash}&s=${salt}&v=1.12.0&c=equicord-rpc`;
        assets.large_image = await getAsset(appId, localCoverArtUrl).catch(() => localCoverArtUrl);
    } else {
        assets.large_image = await getAsset(appId, "navidrome").catch(() => "navidrome");
    }

    if (nd_showSmallImage) {
        assets.small_image = await getAsset(appId, "navidrome").catch(() => "navidrome");
        assets.small_text = "Navidrome";
    }

    const activity: Activity = {
        application_id: appId,
        name: nameString,
        details: track.title,
        state: stateString,
        type: ActivityType.LISTENING,
        flags: ActivityFlags.INSTANCE,
        timestamps: {
            start: cachedStartTimestamp,
            end: endTimestamp,
        },
        assets,
    };

    cachedActivity = activity;
    return activity;
}

async function updatePresence() {
    try {
        setActivity(await getActivity(abortController?.signal));
    } catch (e: any) {
        if (e.name === 'AbortError') return;
        logger.error("Failed to update presence", e);
        setActivity(null);
    }
}

export function start() {
    abortController = new AbortController();
    updatePresence();
    const interval = (settings.store.nd_refreshInterval as number) ?? 10;
    updateInterval = setInterval(updatePresence, interval * 1000);
}

export function stop() {
    abortController?.abort();
    abortController = undefined;
    clearInterval(updateInterval);
    updateInterval = undefined;
    currentTrackId = undefined;
    cachedStartTimestamp = undefined;
    cachedActivity = undefined;
    setActivity(null);
}
