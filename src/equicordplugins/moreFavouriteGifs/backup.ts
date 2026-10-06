/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";
import { chooseFile, saveFile } from "@utils/web";
import { showToast } from "@webpack/common";

import { getGifs, GifMap, mergeGifs } from "./store";

const FILE_NAME = "more-favourite-gifs.json";
const logger = new Logger("MoreFavouriteGifs");

const isHttpUrl = (value: string) => {
    const protocol = URL.parse(value)?.protocol;
    return protocol === "https:" || protocol === "http:";
};

const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/** Keeps only valid entries and copies just the known fields, so a bad file can't add anything unexpected */
function parseBackup(text: string): GifMap {
    const { gifs } = JSON.parse(text) as { gifs?: Record<string, any>; };
    if (!gifs || typeof gifs !== "object") throw new Error("This file isn't a favourite GIFs backup");

    const valid: GifMap = {};
    for (const [url, gif] of Object.entries(gifs)) {
        if (!isHttpUrl(url) || typeof gif?.src !== "string") continue;
        if (![gif.format, gif.width, gif.height, gif.order].every(isNumber)) continue;

        const { format, src, width, height, order } = gif;
        valid[url] = { format, src, width, height, order };
    }

    if (!Object.keys(valid).length) throw new Error("No favourite GIFs found in this file");
    return valid;
}

export async function exportBackup() {
    const data = new TextEncoder().encode(JSON.stringify({ gifs: getGifs() }, null, 4));

    if (IS_DISCORD_DESKTOP) {
        await DiscordNative.fileManager.saveWithDialog(data, FILE_NAME);
    } else {
        saveFile(new File([data], FILE_NAME, { type: "application/json" }));
    }
}

export async function importBackup() {
    const file = await chooseFile("application/json");
    if (!file) return;

    try {
        const added = mergeGifs(parseBackup(await file.text()));
        showToast(added ? `Restored ${added} GIFs` : "All of these GIFs are already saved", "success");
    } catch (e) {
        logger.error("Failed to import backup", e);
        showToast(`Failed to import backup: ${e instanceof Error ? e.message : e}`, "failure");
    }
}
