/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IpcMainInvokeEvent } from "electron";

export async function fetchFile(
    _: IpcMainInvokeEvent,
    url: string
): Promise<{ success: boolean; data?: ArrayBuffer; contentType?: string; error?: string; }> {
    try {
        const response = await fetch(url);
        if (!response.ok) return { success: false, error: `Fetch failed: ${response.status} ${response.statusText}` };

        return {
            success: true,
            data: await response.arrayBuffer(),
            contentType: response.headers.get("content-type") ?? ""
        };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}
