/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";
import { PluginNative } from "@utils/types";

export interface FavouriteGif {
    format: number;
    src: string;
    width: number;
    height: number;
    order: number;
}

/** Favourite GIFs keyed by URL, the same shape as Discord's `favoriteGifs.gifs` */
export type GifMap = Record<string, FavouriteGif>;

const logger = new Logger("MoreFavouriteGifs");
const Native = VencordNative.pluginHelpers.MoreFavouriteGifs as PluginNative<typeof import("./native")>;

// Replaced on every change, never mutated, so it can be used as a useSyncExternalStore snapshot
let gifs: GifMap = {};
const listeners = new Set<() => void>();

export const getGifs = () => gifs;

export function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => void listeners.delete(listener);
}

function setGifs(next: GifMap) {
    gifs = next;
    listeners.forEach(listener => listener());
    Native.writeGifs(next).catch(e => logger.error("Failed to save favourites", e));
}

export async function loadGifs() {
    try {
        const saved = await Native.readGifs() as GifMap | null;
        if (!saved) return;

        // Keep anything added while the file was loading
        gifs = { ...saved, ...gifs };
        listeners.forEach(listener => listener());
    } catch (e) {
        logger.error("Failed to load favourites", e);
    }
}

function highestOrder(...maps: GifMap[]) {
    return Math.max(0, ...maps.flatMap(map => Object.values(map).map(gif => gif.order)));
}

/**
 * Saves a GIF locally and returns how many GIFs are stored locally now.
 * @param discordGifs GIFs stored by Discord, used to sort the new GIF above all of them
 */
export function addGif(url: string, { format, src, width, height }: FavouriteGif, discordGifs: GifMap) {
    const order = highestOrder(discordGifs, gifs) + 1;
    setGifs({ ...gifs, [url]: { format, src, width, height, order } });

    return Object.keys(gifs).length;
}

export function removeGif(...urls: string[]) {
    if (!urls.some(url => url in gifs)) return;

    const next = { ...gifs };
    for (const url of urls) delete next[url];
    setGifs(next);
}
