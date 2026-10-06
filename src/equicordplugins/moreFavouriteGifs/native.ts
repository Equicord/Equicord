/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DATA_DIR } from "@main/utils/constants";
import { mkdir, readFile, rename, writeFile } from "fs/promises";
import { join } from "path";

const FILE = join(DATA_DIR, "MoreFavouriteGifs.json");

// Serialises writes so two quick saves can't clobber the same temp file
let queue: Promise<unknown> = Promise.resolve();

export async function readGifs(): Promise<Record<string, unknown> | null> {
    try {
        const data = JSON.parse(await readFile(FILE, "utf8"));
        return data && typeof data === "object" && !Array.isArray(data) ? data : null;
    } catch (e: any) {
        if (e?.code === "ENOENT") return null;
        throw e;
    }
}

export function writeGifs(_: unknown, gifs: Record<string, unknown>) {
    const job = queue.then(async () => {
        await mkdir(DATA_DIR, { recursive: true });
        const tmp = `${FILE}.tmp`;
        await writeFile(tmp, JSON.stringify(gifs, null, 2), "utf8");
        await rename(tmp, FILE);
    });
    queue = job.catch(() => { });
    return job;
}
