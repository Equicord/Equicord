/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 VisaHolder
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { IpcMainInvokeEvent } from "electron";

const BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
};

export async function fetchJson(_ev: IpcMainInvokeEvent, url: string, opts?: { method?: string; body?: string; headers?: Record<string, string> }): Promise<any> {
    const headers: Record<string, string> = { ...BROWSER_HEADERS, ...(opts?.headers ?? {}) };
    if (opts?.body) headers["Content-Type"] = "application/json";
    const res = await fetch(url, {
        method: opts?.method || "GET",
        headers,
        body: opts?.body,
    });
    if (!res.ok) {
        let body = "";
        try { body = (await res.text()).slice(0, 400); } catch { /* swallow */ }
        throw new Error(`HTTP ${res.status} for ${url}${body ? ` — body: ${body}` : ""}`);
    }
    return await res.json();
}

export async function fetchText(_ev: IpcMainInvokeEvent, url: string): Promise<string> {
    const res = await fetch(url, { headers: BROWSER_HEADERS });
    if (!res.ok) {
        throw new Error(`HTTP ${res.status} for ${url}`);
    }
    return await res.text();
}

export async function ping(_ev: IpcMainInvokeEvent): Promise<string> {
    return "pong";
}
