/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { services } from "./core";
import type { Song, UserData } from "./types";

interface SafeParseSuccess<T> {
    data: T;
    error: null;
}

interface SafeParseFailure {
    data: null;
    error: Error;
}

type SafeParseResult<T> = SafeParseSuccess<T> | SafeParseFailure;

function safeParseSong(input: unknown): SafeParseResult<Song> {
    if (!input || typeof input !== "object") {
        return { data: null, error: new Error("Song must be an object") };
    }

    const song = input as Partial<Song>;
    if (typeof song.service !== "string" || typeof song.type !== "string" || typeof song.id !== "string") {
        return { data: null, error: new Error("Song fields must be strings") };
    }

    const service = services.find(x => x.name === song.service);
    if (!service || !service.types.includes(song.type)) {
        return { data: null, error: new Error("Invalid song service/type") };
    }

    return { data: song as Song, error: null };
}

export const SongSchema = {
    safeParse: safeParseSong,
};

export const UserDataSchema = {
    max(limit: number) {
        return {
            safeParse(input: unknown): SafeParseResult<UserData> {
                if (!Array.isArray(input)) {
                    return { data: null, error: new Error("UserData must be an array") };
                }

                if (input.length > limit) {
                    return { data: null, error: new Error("UserData too large") };
                }

                const parsed: Song[] = [];
                for (const item of input) {
                    const result = safeParseSong(item);
                    if (result.error) return { data: null, error: result.error };
                    parsed.push(result.data);
                }

                return { data: parsed, error: null };
            },
        };
    },
};

export type { Song, UserData };
