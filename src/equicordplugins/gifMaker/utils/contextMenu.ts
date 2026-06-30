/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { lodash } from "@webpack/common";

import { DEFAULT_OPTIONS } from "../types";

export const MEDIA_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif", "video/mp4", "video/webm", "video/quicktime"];
export const MEDIA_EXT_RE = /\.(png|jpe?g|webp|gif|mp4|webm|mov)([?#]|$)/i;
export const VIDEO_EXT_RE = /\.(mp4|webm|mov)([?#]|$)/i;

interface MediaAttachment {
    content_type?: string;
    proxy_url?: string;
    url?: string;
    width?: number;
    height?: number;
}

interface MediaEmbed {
    video?: { proxyURL?: string; url?: string; width?: number; height?: number; };
    image?: { proxyURL?: string; url?: string; width?: number; height?: number; };
    thumbnail?: { proxyURL?: string; url?: string; width?: number; height?: number; };
}

interface MediaMessage {
    attachments?: MediaAttachment[];
    embeds?: MediaEmbed[];
}

export function getMediaInfo(props: Record<string, unknown>): { url: string; isVideo: boolean; sourceWidth?: number; sourceHeight?: number; } | null {
    const msg = props.message as MediaMessage | undefined;

    const directAttachment = props.attachment as MediaAttachment | undefined;
    if (directAttachment?.proxy_url && MEDIA_TYPES.some(t => directAttachment.content_type?.startsWith(t))) {
        return {
            url: directAttachment.proxy_url ?? directAttachment.url,
            isVideo: directAttachment.content_type?.startsWith("video/") || false,
            sourceWidth: directAttachment.width,
            sourceHeight: directAttachment.height
        };
    }

    const msgAttachment = msg?.attachments?.find(a => MEDIA_TYPES.some(t => a.content_type?.startsWith(t)));
    if (msgAttachment?.proxy_url) {
        return {
            url: msgAttachment.proxy_url ?? msgAttachment.url,
            isVideo: msgAttachment.content_type?.startsWith("video/") || false,
            sourceWidth: msgAttachment.width,
            sourceHeight: msgAttachment.height
        };
    }

    if (msg?.embeds) {
        for (const embed of msg.embeds) {
            const v = embed?.video;
            if (v?.proxyURL || v?.url) {
                return { url: v.proxyURL ?? (v.url || ""), isVideo: true, sourceWidth: v.width, sourceHeight: v.height };
            }
            const i = embed?.image ?? embed?.thumbnail;
            if (i?.proxyURL || i?.url) {
                return { url: i.proxyURL ?? (i.url || ""), isVideo: false, sourceWidth: i.width, sourceHeight: i.height };
            }
        }
    }

    const linkUrl = (props.itemHref ?? props.itemSrc ?? props.src) as string | undefined;
    if (linkUrl && MEDIA_EXT_RE.test(linkUrl)) {
        return {
            url: linkUrl,
            isVideo: VIDEO_EXT_RE.test(linkUrl)
        };
    }

    return null;
}

export function clamp(val: number, min: number, max: number, fallback: number): number {
    return lodash.clamp(val || fallback, min, max);
}

export function getInitialSize(
    maxW: number,
    maxH: number,
    sourceWidth?: number,
    sourceHeight?: number,
    storedWidth?: number,
    storedHeight?: number
): [number, number] {
    if (sourceWidth && sourceHeight) {
        if (sourceWidth <= maxW && sourceHeight <= maxH) {
            return [sourceWidth, sourceHeight];
        }
        const scale = Math.min(maxW / sourceWidth, maxH / sourceHeight);
        return [Math.round(sourceWidth * scale), Math.round(sourceHeight * scale)];
    }
    return [storedWidth ?? DEFAULT_OPTIONS.width, storedHeight ?? DEFAULT_OPTIONS.height];
}
