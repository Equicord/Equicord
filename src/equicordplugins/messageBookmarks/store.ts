/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";

import type { Bookmark } from "./types";

// Same key as the previous userplugins version to preserve existing bookmarks
const STORE_KEY = "LoststrHeart_bookmarks";
export let bookmarksCache: Bookmark[] | null = null;

export async function getBookmarks(): Promise<Bookmark[]> {
    if (bookmarksCache === null) {
        bookmarksCache = await DataStore.get<Bookmark[]>(STORE_KEY) ?? [];
    }
    return bookmarksCache!;
}

export async function saveBookmarks(bookmarks: Bookmark[]): Promise<void> {
    bookmarksCache = [...bookmarks];
    await DataStore.set(STORE_KEY, bookmarksCache);
}

export function clearCache(): void {
    bookmarksCache = null;
}
