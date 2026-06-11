/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { IpcMainInvokeEvent } from "electron";

import { buildJsonHeaders, OPENCODE_ZEN_CHAT_COMPLETIONS_ENDPOINT, OPENCODE_ZEN_MODELS_ENDPOINT } from "./helpers";

export interface OpenCodeZenResult {
    ok: boolean;
    status: number;
    body: string;
    error?: string;
}

const MAX_PAYLOAD_BYTES = 256_000;
const MAX_RESPONSE_BYTES = 1_000_000;
const REQUEST_TIMEOUT_MS = 30_000;
const OPENCODE_ZEN_ALLOWED_ORIGIN = "https://opencode.ai";

async function readCappedResponse(response: Response): Promise<string> {
    const reader = response.body?.getReader();
    if (!reader) return await response.text();

    const chunks: Uint8Array[] = [];
    let received = 0;

    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;

        received += value.byteLength;
        if (received > MAX_RESPONSE_BYTES) {
            await reader.cancel();
            throw new Error("Response too large.");
        }

        chunks.push(value);
    }

    const body = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.byteLength;
    }

    return new TextDecoder().decode(body);
}

function scrubFetchError(error: unknown): string {
    if (error instanceof Error && error.name === "AbortError") return "Request timed out.";
    if (error instanceof Error && error.message === "Response too large.") return error.message;

    return "Request failed.";
}

function getAllowedOpenCodeUrl(url: string): string | null {
    try {
        const parsedUrl = new URL(url);
        if (parsedUrl.origin === OPENCODE_ZEN_ALLOWED_ORIGIN) return parsedUrl.toString();
    } catch {
        return null;
    }

    return null;
}

async function makeOpenCodeRequest(url: string, init: RequestInit): Promise<OpenCodeZenResult> {
    const requestUrl = getAllowedOpenCodeUrl(url);
    if (!requestUrl) return { ok: false, status: 0, body: "", error: "Invalid endpoint." };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(requestUrl, {
            ...init,
            redirect: "error",
            signal: controller.signal,
        });

        const body = await readCappedResponse(response);
        return { ok: response.ok, status: response.status, body };
    } catch (error) {
        return { ok: false, status: 0, body: "", error: scrubFetchError(error) };
    } finally {
        clearTimeout(timeout);
    }
}

export async function makeModelsRequest(_: IpcMainInvokeEvent): Promise<OpenCodeZenResult> {
    return await makeOpenCodeRequest(OPENCODE_ZEN_MODELS_ENDPOINT, { method: "GET" });
}

export async function makeTranslateRequest(_: IpcMainInvokeEvent, payload: string): Promise<OpenCodeZenResult> {
    if (typeof payload !== "string") return { ok: false, status: 0, body: "", error: "Invalid request." };
    if (!payload || new TextEncoder().encode(payload).byteLength > MAX_PAYLOAD_BYTES) {
        return { ok: false, status: 0, body: "", error: "Request body is too large." };
    }

    return await makeOpenCodeRequest(OPENCODE_ZEN_CHAT_COMPLETIONS_ENDPOINT, {
        method: "POST",
        headers: buildJsonHeaders(),
        body: payload,
    });
}
