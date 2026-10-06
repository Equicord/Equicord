/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";
import { Logger } from "@utils/Logger";

export interface FavouriteGif {
    format: number;
    src: string;
    width: number;
    height: number;
    order: number;
}

/** Favourite GIFs keyed by URL, the same shape as Discord's `favoriteGifs.gifs` */
export type GifMap = Record<string, FavouriteGif>;

const DATA_KEY = "MoreFavouriteGifs_gifs";
const logger = new Logger("MoreFavouriteGifs");

// Replaced on every change, never mutated, so it can be used as a useSyncExternalStore snapshot
let gifs: GifMap = {};
const listeners = new Set<() => void>();
const saveListeners = new Set<() => void>();

export const getGifs = () => gifs;

export function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => void listeners.delete(listener);
}

/** Calls the listener each time the GIFs have been written to the DataStore */
export function onSave(listener: () => void) {
    saveListeners.add(listener);
    return () => void saveListeners.delete(listener);
}

function setGifs(next: GifMap) {
    gifs = next;
    listeners.forEach(listener => listener());

    DataStore.set(DATA_KEY, next)
        .then(() => saveListeners.forEach(listener => listener()))
        .catch(e => logger.error("Failed to save favourites", e));
}

export async function loadGifs() {
    try {
        const saved = await DataStore.get<GifMap>(DATA_KEY);
        if (!saved) return;

        // Keep anything added while the DataStore was loading
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

/** Adds GIFs that aren't saved yet, and returns how many were added */
export function mergeGifs(incoming: GifMap) {
    const added = Object.keys(incoming).filter(url => !(url in gifs)).length;
    if (added) setGifs({ ...incoming, ...gifs });

    return added;
}
