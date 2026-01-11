/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";

import { setRecentStickers } from "./components";
import {
    convert,
    getStickerPackById
} from "./lineStickers";
import {
    deleteStickerPack,
    getStickerPackMetas,
    saveStickerPack
} from "./stickers";
import { StickerPack } from "./types";

const logger = new Logger("MoreStickers");

export async function initTest() {
    setRecentStickers([]);

    const stickerPackMetas = await getStickerPackMetas();
    for (const meta of stickerPackMetas) {
        await deleteStickerPack(meta.id);
    }

    const lineStickerPackIds = [
        "22814489", // LV.47
        "22567773", // LV.46
        "22256215", // LV.45
        "21936635", // LV.44
        "21836565", // LV.43
    ];
    const ps: Promise<StickerPack | null>[] = [];
    for (const id of lineStickerPackIds) {
        ps.push((async () => {
            try {
                const lsp = await getStickerPackById(id);
                const sp = convert(lsp);
                return sp;
            } catch (e) {
                logger.error("Failed to fetch sticker pack: " + id);
                logger.error(e);
                return null;
            }
        })());
    }
    const stickerPacks = (await Promise.all(ps)).filter(sp => sp !== null) as StickerPack[];

    for (const sp of stickerPacks) {
        await saveStickerPack(sp);
    }
}

export async function clearTest() {
    setRecentStickers([]);

    const stickerPackMetas = await getStickerPackMetas();
    for (const meta of stickerPackMetas) {
        await deleteStickerPack(meta.id);
    }
}
