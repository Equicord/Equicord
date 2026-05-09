/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 sioaeko and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IpcMainInvokeEvent, net } from "electron";

export async function fetchChunk(
    _: IpcMainInvokeEvent,
    url: string
): Promise<{ success: boolean; data?: ArrayBuffer; contentType?: string; error?: string; }> {
    try {
        const parsed = new URL(url);
        if (
            parsed.protocol !== "https:"
            || !["cdn.discordapp.com", "media.discordapp.net"].includes(parsed.hostname)
        ) {
            return { success: false, error: "Unsupported attachment URL" };
        }

        const response = await net.fetch(url);
        if (!response.ok) {
            return { success: false, error: `Fetch failed: ${response.status} ${response.statusText}` };
        }

        return {
            success: true,
            data: await response.arrayBuffer(),
            contentType: response.headers.get("content-type") || ""
        };
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
    }
}
