/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";
import { PluginNative } from "@utils/types";
import { Activity } from "@vencord/discord-types";
import {
    ApplicationAssetUtils,
    FluxDispatcher,
    showToast,
} from "@webpack/common";

import { settings } from "../settings";
import { StorytellerBook, StorytellerMediaData } from "../types/storyteller";

const Native = VencordNative.pluginHelpers.RichPresence as PluginNative<
    typeof import("../native")
>;

const APPLICATION_ID = "1108588077900898414";
const SOCKET_ID = "RichPresence_Storyteller";
const FALLBACK_COVER = "https://cdn-icons-png.flaticon.com/512/29/29302.png";
const logger = new Logger("RichPresence:Storyteller");

let authToken: string | null = null;
let updateInterval: NodeJS.Timeout | undefined;
const coverCache = new Map<string, string | null>();

let cachedTimestamps: { start: number; end: number } | undefined;
let cachedBookId: string | null = null;
let cachedProgression: number | null = null;

async function getAsset(key: string): Promise<string> {
    return (
        await ApplicationAssetUtils.fetchAssetIds(APPLICATION_ID, [key])
    )[0];
}

function setActivity(activity: Activity | null) {
    FluxDispatcher.dispatch({
        type: "LOCAL_ACTIVITY_UPDATE",
        activity,
        socketId: SOCKET_ID,
    });
}

function cleanTitle(title: string): string {
    return title
        .replace(/\s*\(.*?\)/g, "")
        .replace(/\s*:.*$/, "")
        .trim();
}

async function searchOpenLibrary(
    title: string,
    author?: string,
): Promise<string | null> {
    const params = new URLSearchParams({
        title,
        ...(author && { author }),
        limit: "5",
        fields: "title,cover_i",
    });
    const res = await fetch(
        `https://openlibrary.org/search.json?${params.toString()}`,
    );
    if (!res.ok) return null;
    const data = await res.json();

    for (const doc of data?.docs ?? []) {
        if (!doc.cover_i) continue;
        return `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`;
    }
    return null;
}

async function searchGoogleBooks(
    title: string,
    author?: string,
): Promise<string | null> {
    const query = author
        ? `intitle:${title}+inauthor:${author}`
        : `intitle:${title}`;
    const res = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=3&fields=items(volumeInfo/imageLinks)`,
    );
    if (!res.ok) return null;
    const data = await res.json();

    for (const item of data?.items ?? []) {
        const thumbnail =
            item?.volumeInfo?.imageLinks?.thumbnail ??
            item?.volumeInfo?.imageLinks?.smallThumbnail;
        if (thumbnail) return thumbnail.replace(/^http:/, "https:");
    }
    return null;
}

async function fetchCoverUrl(
    title: string,
    author?: string,
): Promise<string | null> {
    try {
        const clean = cleanTitle(title);

        let url = await searchOpenLibrary(clean, author);
        if (url) return url;

        if (author) {
            url = await searchOpenLibrary(clean);
            if (url) return url;
        }

        if (clean !== title) {
            url = await searchOpenLibrary(title, author);
            if (url) return url;
        }

        url = await searchGoogleBooks(clean, author);
        if (url) return url;

        return null;
    } catch {
        return null;
    }
}

async function authenticate(): Promise<boolean> {
    const { st_serverUrl, st_username, st_password } = settings.store;
    if (!st_serverUrl || !st_username || !st_password) {
        logger.warn(
            "Storyteller server URL, username, or password is not set.",
        );
        showToast("Storyteller RPC is not configured.", "failure", {
            duration: 15000,
        });
        return false;
    }

    try {
        const token = await Native.storytellerGetToken(
            st_serverUrl,
            st_username,
            st_password,
        );
        if (!token) {
            logger.error("Failed to authenticate with Storyteller");
            authToken = null;
            return false;
        }
        authToken = token;
        return true;
    } catch (e) {
        logger.error("Failed to authenticate with Storyteller", e);
        authToken = null;
        return false;
    }
}

async function fetchBooks(): Promise<StorytellerBook[] | null> {
    if (!authToken && !(await authenticate())) return null;

    try {
        const books = await Native.storytellerFetchBooks(
            settings.store.st_serverUrl!,
            authToken!,
        );

        if (!books) {
            authToken = null;
            if (await authenticate()) {
                return await Native.storytellerFetchBooks(
                    settings.store.st_serverUrl!,
                    authToken!,
                );
            }
            return null;
        }

        return books;
    } catch (e) {
        logger.error("Failed to fetch books from Storyteller", e);
        return null;
    }
}

function findActiveBook(books: StorytellerBook[]): StorytellerBook | null {
    const thresholdMs = (settings.store.st_activeThreshold ?? 120) * 1000;
    const now = Date.now();

    let bestBook: StorytellerBook | null = null;
    let bestTimestamp = 0;

    for (const book of books) {
        if (!book.position) continue;

        const timeSince = now - book.position.timestamp;
        if (timeSince > thresholdMs) continue;

        if (book.position.timestamp > bestTimestamp) {
            bestTimestamp = book.position.timestamp;
            bestBook = book;
        }
    }

    return bestBook;
}

function buildMediaData(book: StorytellerBook): StorytellerMediaData {
    const baseUrl = settings.store.st_serverUrl!.replace(/\/$/, "");

    return {
        name: book.title,
        author: book.authors?.[0]?.name,
        narrator: book.narrators?.[0]?.name,
        series: book.series?.[0]?.name,
        seriesPosition: book.series?.[0]?.position,
        duration: book.audiobook?.duration ?? undefined,
        totalProgression:
            book.position?.locator?.locations?.totalProgression ?? undefined,
        imageUrl: `${baseUrl}/api/v2/books/${book.uuid}/cover`,
        bookId: book.uuid,
    };
}

async function getActivity(): Promise<Activity | null> {
    const books = await fetchBooks();
    if (!books || books.length === 0) return null;

    const activeBook = findActiveBook(books);
    if (!activeBook) return null;

    const mediaData = buildMediaData(activeBook);

    let coverUrl: string | null = null;
    if (settings.store.st_fetchCovers !== false) {
        const cacheKey = mediaData.bookId;
        if (coverCache.has(cacheKey)) {
            coverUrl = coverCache.get(cacheKey) ?? null;
        } else {
            try {
                coverUrl = await fetchCoverUrl(
                    mediaData.name,
                    mediaData.author,
                );
            } catch {
                /* noop */
            }
            coverCache.set(cacheKey, coverUrl);
        }
    }

    const assets = {
        large_image: await getAsset(coverUrl || FALLBACK_COVER),
        large_text: mediaData.series
            ? mediaData.seriesPosition != null
                ? `${mediaData.series} #${mediaData.seriesPosition}`
                : mediaData.series
            : "Storyteller",
    };

    const displayTitle = cleanTitle(mediaData.name);

    let state: string;
    if (mediaData.series && mediaData.author) {
        state = `${mediaData.series} \u2022 ${mediaData.author}`;
    } else if (mediaData.author) {
        state = `by ${mediaData.author}`;
    } else if (mediaData.narrator) {
        state = `Narrated by ${mediaData.narrator}`;
    } else {
        state = "Audiobook";
    }

    // Only recalculate timestamps when progression changes to avoid bar resets
    let timestamps: { start: number; end: number } | undefined;
    if (mediaData.duration && mediaData.totalProgression != null) {
        if (
            cachedBookId !== mediaData.bookId ||
            cachedProgression !== mediaData.totalProgression ||
            !cachedTimestamps
        ) {
            const elapsed = mediaData.duration * mediaData.totalProgression;
            const remaining = mediaData.duration - elapsed;
            cachedTimestamps = {
                start: Date.now() - elapsed * 1000,
                end: Date.now() + remaining * 1000,
            };
            cachedBookId = mediaData.bookId;
            cachedProgression = mediaData.totalProgression;
        }
        timestamps = cachedTimestamps;
    }

    return {
        application_id: APPLICATION_ID,
        name: "Storyteller",
        details: displayTitle,
        state,
        assets,
        timestamps,
        type: 2,
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
    authToken = null;
    updatePresence();
    updateInterval = setInterval(updatePresence, 15000);
}

export function stop() {
    clearInterval(updateInterval);
    updateInterval = undefined;
    authToken = null;
    cachedTimestamps = undefined;
    cachedBookId = null;
    cachedProgression = null;
    setActivity(null);
}
