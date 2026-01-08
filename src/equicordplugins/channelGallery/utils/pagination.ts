/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Constants, RestAPI } from "@webpack/common";

export async function fetchMessagesChunk(args: {
    channelId: string;
    before: string | null;
    limit: number;
    signal?: AbortSignal;
}): Promise<any[]> {
    if (!args.channelId) return [];
    if (args.signal && args.signal.aborted) {
        const err = new Error("AbortError");
        err.name = "AbortError";
        throw err;
    }

    try {
        const res = await RestAPI.get({
            url: Constants.Endpoints.MESSAGES(args.channelId),
            query: {
                limit: args.limit,
                ...(args.before ? { before: args.before } : {})
            },
            retries: 1
        });

        if (args.signal && args.signal.aborted) {
            const err = new Error("AbortError");
            err.name = "AbortError";
            throw err;
        }

        if (!res) return [];
        const body = res.body ?? res;
        if (!Array.isArray(body)) {
            return [];
        }
        return body;
    } catch (e: unknown) {
        if (args.signal && args.signal.aborted) {
            const err = new Error("AbortError");
            err.name = "AbortError";
            throw err;
        }
        if (e instanceof Error && (e.name === "AbortError" || e.message === "AbortError")) {
            const err = new Error("AbortError");
            err.name = "AbortError";
            throw err;
        }
        throw new Error("fetch_failed");
    }
}
