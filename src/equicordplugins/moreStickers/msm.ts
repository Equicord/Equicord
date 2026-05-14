/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { fetchDynamicPackSetMeta, saveDynamicPackSetMeta } from "./stickers";
import type { DynamicPackSetMeta, DynamicStickerPackMeta } from "./types";

export type MsmDynamicPackSetMeta = DynamicPackSetMeta & {
    msm?: {
        label?: string;
        subscriptionUrl: string;
        lastSyncedAt?: string;
        lastError?: string;
    };
};

function bearerHeaders(token: string): Record<string, string> | undefined {
    const trimmed = token.trim();
    if (!trimmed) return undefined;
    return {
        Authorization: trimmed.toLowerCase().startsWith("bearer ") ? trimmed : `Bearer ${trimmed}`,
    };
}

export function isMsmSubscriptionUrl(value: string): boolean {
    try {
        const path = new URL(value).pathname;
        return /^\/api\/public\/packs\/[^/]+\/subscription$/.test(path)
            || /^\/api\/public\/subscriptions\/[^/]+$/.test(path);
    } catch {
        return false;
    }
}

function assertObject(value: unknown, label: string): asserts value is Record<string, unknown> {
    if (!value || typeof value !== "object") throw new Error(`${label} must be an object`);
}

function assertDynamicStickerPackMeta(value: unknown): asserts value is DynamicStickerPackMeta {
    assertObject(value, "pack");
    const { dynamic, id } = value;
    if (typeof id !== "string") throw new Error("pack.id must be a string");
    assertObject(dynamic, "pack.dynamic");
    if (typeof dynamic.refreshUrl !== "string") throw new Error("pack.dynamic.refreshUrl must be a string");
}

function assertDynamicPackSetMeta(value: unknown): asserts value is DynamicPackSetMeta {
    assertObject(value, "MSM subscription response");
    const { id, packs, refreshUrl } = value;
    if (typeof id !== "string") throw new Error("subscription.id must be a string");
    if (typeof refreshUrl !== "string") throw new Error("subscription.refreshUrl must be a string");
    if (!Array.isArray(packs)) throw new Error("subscription.packs must be an array");
    packs.forEach(assertDynamicStickerPackMeta);
}

function withMsmMetadata(
    meta: DynamicPackSetMeta,
    subscriptionUrl: string,
    token: string,
    label: string,
    previous?: MsmDynamicPackSetMeta
): MsmDynamicPackSetMeta {
    const { authHeaders: metaAuthHeaders, id, packs: metaPacks, title } = meta;
    const authHeaders = metaAuthHeaders ?? bearerHeaders(token);
    const packs = metaPacks.map(pack => {
        const { dynamic } = pack;
        return {
            ...pack,
            dynamic: {
                ...dynamic,
                authHeaders: dynamic.authHeaders ?? authHeaders,
            },
        };
    });

    return {
        ...meta,
        authHeaders,
        packs,
        msm: {
            label: label.trim() || previous?.msm?.label || title || id,
            subscriptionUrl,
            lastSyncedAt: new Date().toISOString(),
        },
    };
}

export async function fetchMsmSubscription(subscriptionUrl: string, token = "", label = ""): Promise<MsmDynamicPackSetMeta> {
    const url = subscriptionUrl.trim();
    if (!isMsmSubscriptionUrl(url)) throw new Error("Invalid MSM subscription URL");

    const headers = bearerHeaders(token);
    const response = await fetch(url, headers ? { headers } : undefined);
    if (!response.ok) throw new Error(`MSM subscription fetch failed: HTTP ${response.status}`);

    const data = await response.json();
    assertDynamicPackSetMeta(data);

    return withMsmMetadata(data, url, token, label);
}

export async function addMsmSubscription(subscriptionUrl: string, token = "", label = ""): Promise<MsmDynamicPackSetMeta> {
    const meta = await fetchMsmSubscription(subscriptionUrl, token, label);
    await saveDynamicPackSetMeta(meta, undefined, true);
    return meta;
}

export async function syncMsmSubscription(meta: MsmDynamicPackSetMeta, force = true): Promise<MsmDynamicPackSetMeta> {
    try {
        const fetched = await fetchDynamicPackSetMeta(meta);
        if (!fetched) throw new Error("MSM subscription refresh failed");

        const synced = withMsmMetadata(
            fetched,
            meta.msm?.subscriptionUrl ?? meta.refreshUrl,
            meta.authHeaders?.Authorization ?? "",
            meta.msm?.label ?? meta.title ?? meta.id,
            meta
        );
        await saveDynamicPackSetMeta(synced, undefined, force);
        return synced;
    } catch (error) {
        const failed: MsmDynamicPackSetMeta = {
            ...meta,
            msm: {
                label: meta.msm?.label,
                subscriptionUrl: meta.msm?.subscriptionUrl ?? meta.refreshUrl,
                lastSyncedAt: meta.msm?.lastSyncedAt,
                lastError: error instanceof Error ? error.message : String(error),
            },
        };
        await saveDynamicPackSetMeta(failed);
        throw error;
    }
}
