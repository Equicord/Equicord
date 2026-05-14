/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { React } from "@webpack/common";
import type { JSX } from "react";

import { getStickerPackMeta } from "./stickers";
import type { Sticker } from "./types";
import { corsFetch } from "./utils";

const objectUrls = new Map<string, string>();

function sameOrigin(left: string, right: string): boolean {
    try {
        return new URL(left).origin === new URL(right).origin;
    } catch {
        return false;
    }
}

function cacheKey(src: string, headers?: Record<string, string>): string {
    return `${src}\n${JSON.stringify(headers ?? {})}`;
}

async function getAuthHeadersForAsset(src: string, stickerPackId?: string): Promise<Record<string, string> | undefined> {
    if (!stickerPackId) return undefined;

    const meta = await getStickerPackMeta(stickerPackId);
    const { dynamic } = meta ?? {};
    const { authHeaders: headers, refreshUrl } = dynamic ?? {};
    if (!headers || !refreshUrl || !sameOrigin(src, refreshUrl)) return undefined;
    return headers;
}

export async function fetchStickerAsset(sticker: Sticker): Promise<Response> {
    const headers = await getAuthHeadersForAsset(sticker.image, sticker.stickerPackId);
    if (headers && Object.keys(headers).length > 0) {
        return fetch(sticker.image, { headers });
    }
    return corsFetch(sticker.image);
}

export async function resolveStickerAssetUrl(src: string, stickerPackId?: string): Promise<string> {
    const headers = await getAuthHeadersForAsset(src, stickerPackId);
    if (!headers || Object.keys(headers).length === 0) return src;

    const key = cacheKey(src, headers);
    const cached = objectUrls.get(key);
    if (cached) return cached;

    const response = await fetch(src, { headers });
    if (!response.ok) throw new Error(`Failed to fetch protected sticker asset: HTTP ${response.status}`);

    const objectUrl = URL.createObjectURL(await response.blob());
    objectUrls.set(key, objectUrl);
    return objectUrl;
}

export function revokeStickerAssetCache(): void {
    for (const url of objectUrls.values()) {
        URL.revokeObjectURL(url);
    }
    objectUrls.clear();
}

export function StickerAssetImage({
    src,
    stickerPackId,
    ...props
}: JSX.IntrinsicElements["img"] & { stickerPackId?: string; }) {
    const [resolvedSrc, setResolvedSrc] = React.useState<string | undefined>(src);

    React.useEffect(() => {
        let cancelled = false;
        if (!src) {
            setResolvedSrc(src);
            return;
        }

        resolveStickerAssetUrl(src, stickerPackId)
            .then(nextSrc => {
                if (!cancelled) setResolvedSrc(nextSrc);
            })
            .catch(() => {
                if (!cancelled) setResolvedSrc(src);
            });

        return () => {
            cancelled = true;
        };
    }, [src, stickerPackId]);

    return <img {...props} src={resolvedSrc} />;
}
