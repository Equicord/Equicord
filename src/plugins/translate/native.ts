/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IpcMainInvokeEvent } from "electron";

const requests = new Map<string, AbortController>();

export function cancelTranslateRequest(event: IpcMainInvokeEvent, requestId: string) {
    requests.get(`${event.sender.id}:${requestId}`)?.abort();
}

export async function makeDeeplTranslateRequest(event: IpcMainInvokeEvent, pro: boolean, apiKey: string, payload: string, requestId?: string) {
    const key = requestId === undefined ? undefined : `${event.sender.id}:${requestId}`;
    const controller = new AbortController();
    if (key !== undefined) requests.set(key, controller);
    const url = pro
        ? "https://api.deepl.com/v2/translate"
        : "https://api-free.deepl.com/v2/translate";

    try {
        const res = await fetch(url, {
            signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]),
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `DeepL-Auth-Key ${apiKey}`
            },
            body: payload
        });

        const data = await res.text();
        return { status: res.status, data };
    } catch (e) {
        return { status: -1, data: String(e) };
    } finally {
        if (key !== undefined) requests.delete(key);
    }
}

export async function makeKagiTranslateRequest(event: IpcMainInvokeEvent, token: string, text: string, sourceLang: string, targetLang: string, requestId?: string) {
    const key = requestId === undefined ? undefined : `${event.sender.id}:${requestId}`;
    const controller = new AbortController();
    if (key !== undefined) requests.set(key, controller);
    const url = "https://translate.kagi.com/api/translate";

    try {
        const res = await fetch(url, {
            signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]),
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Cookie": `kagi_session=${token}`
            },
            body: JSON.stringify({
                text,
                from: sourceLang,
                to: targetLang,
                model: "standard"
            }),
        });

        const data = await res.json();
        return { status: res.status, data };
    } catch (e) {
        return { status: -1, data: String(e) };
    } finally {
        if (key !== undefined) requests.delete(key);
    }
}
