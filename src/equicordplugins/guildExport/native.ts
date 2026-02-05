/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export function bluGuildExportNativeMarker() { }

// Electron IPC handlers always receive the event as the first argument
export async function saveFile(_: any, baseDir: string, subPath: string, data: Uint8Array | string): Promise<void> {
    const fullPath = path.join(baseDir, subPath);
    const dir = path.dirname(fullPath);

    await mkdir(dir, { recursive: true });

    // If it's a Buffer/Uint8Array, write as is. If string, write as utf8.
    const content = typeof data === "string" ? data : Buffer.from(data);
    await writeFile(fullPath, content);
}

export async function fetchAsset(_: any, url: string): Promise<Uint8Array | null> {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    return new Uint8Array(await resp.arrayBuffer());
}
