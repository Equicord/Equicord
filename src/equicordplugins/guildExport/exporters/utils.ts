/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { getNative } from "../nativeUtils";
import { ExporterContext } from "./types";

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const sanitize = (name: string) => name.replace(/[<>:"/\\|?*]/g, "_");

export async function downloadAsset(url: string, path: string, ctx: ExporterContext) {
    try {
        const native = getNative();
        let uint8: Uint8Array | null = null;

        if (native?.fetchAsset) {
            uint8 = await native.fetchAsset(url);
        } else {
            const resp = await fetch(url);
            if (resp.ok) {
                uint8 = new Uint8Array(await resp.arrayBuffer());
            } else {
                ctx.logger.error(`Failed to download asset: ${url} (Status: ${resp.status})`);
                return;
            }
        }

        if (uint8) {
            ctx.logger.info(`Saving asset to ${path} (${uint8.length} bytes)`);
            await ctx.save(path, uint8);
        } else {
            ctx.logger.error(`Failed to fetch asset (empty data): ${url}`);
        }
    } catch (e) {
        ctx.logger.error(`Error downloading asset: ${url}`, e);
    }
}

/**
 * Recursively removes null values, empty strings, and empty objects/arrays
 */
export function removeNullValues<T>(obj: T): T | null {
    if (obj === null || obj === undefined || (typeof obj === "string" && obj === "")) {
        return null;
    }

    if (Array.isArray(obj)) {
        const cleanedArray = obj
            .map(item => removeNullValues(item))
            .filter(item => item !== null && item !== undefined);

        return cleanedArray.length > 0 ? (cleanedArray as unknown as T) : null;
    }

    if (typeof obj === "object") {
        const result: any = {};
        let hasProps = false;

        for (const [key, value] of Object.entries(obj)) {
            const cleanedValue = removeNullValues(value);
            if (cleanedValue !== null && cleanedValue !== undefined) {
                result[key] = cleanedValue;
                hasProps = true;
            }
        }
        return hasProps ? (result as T) : null;
    }

    return obj;
}
