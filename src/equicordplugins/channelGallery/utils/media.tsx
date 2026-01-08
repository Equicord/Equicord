/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findComponentByCodeLazy } from "@webpack";
import { React } from "@webpack/common";

const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "avif"]);
const VIDEO_EXTS = new Set(["mp4", "webm", "mov", "m4v"]);
const ANIMATED_EXTS = new Set(["gif", "mp4", "webm", "mov", "m4v"]);

function getExt(name?: string): string {
    if (!name) return "";
    const idx = name.lastIndexOf(".");
    if (idx === -1) return "";
    return name.slice(idx + 1).toLowerCase();
}

function isAnimatedExt(ext: string): boolean {
    return ANIMATED_EXTS.has(ext);
}

function isVideoExt(ext: string): boolean {
    return VIDEO_EXTS.has(ext);
}

function extractOriginalUrl(url: string): string {
    if (!url) return url;
    try {
        const u = new URL(url);
        // Instagram
        if (u.hostname.includes("instagram.com") || u.hostname.includes("cdninstagram.com")) {
            const match = url.match(/\/p\/([^/]+)/);
            if (match) return url;
        }
        // Tenor - try to get original
        if (u.hostname.includes("tenor.com") || u.hostname.includes("media.tenor.com")) {
            // Remove size parameters
            u.searchParams.delete("width");
            u.searchParams.delete("height");
            return u.toString();
        }
        // Remove size parameters for other URLs
        u.searchParams.delete("width");
        u.searchParams.delete("height");
        u.searchParams.delete("size");
        return u.toString();
    } catch {
        return url;
    }
}

function isTenorStatic(url: string, contentType?: string): boolean {
    if (!url) return false;
    const ext = getExt(url.split("?")[0]);
    // Tenor static images are usually PNGs
    if (ext === "png" && (url.includes("tenor.com") || url.includes("media.tenor.com"))) {
        // Check content type if available
        if (contentType && contentType.includes("image/png")) {
            return true;
        }
    }
    return false;
}

function isSpoiler(attachment: any): boolean {
    if (!attachment) return false;
    const filename = attachment.filename ? String(attachment.filename) : "";
    return Boolean(attachment.spoiler) || filename.startsWith("SPOILER_");
}

function isAllowedImageFilename(name: string | undefined, includeGifs: boolean): boolean {
    if (!name) return false;
    const ext = getExt(name);
    if (!ext) return false;
    if (!includeGifs && ext === "gif") return false;
    return IMAGE_EXTS.has(ext);
}

function isImageAttachment(att: any, includeGifs: boolean): boolean {
    if (!att || !att.url) return false;
    if (isSpoiler(att)) return false;

    const ct = att.content_type ? String(att.content_type) : "";
    const contentType = ct.toLowerCase();
    if (contentType.startsWith("image/")) {
        if (!includeGifs && contentType === "image/gif") return false;
        return true;
    }

    return isAllowedImageFilename(att.filename, includeGifs);
}

function isVideoAttachment(att: any): boolean {
    if (!att || !att.url) return false;
    if (isSpoiler(att)) return false;

    const ct = att.content_type ? String(att.content_type) : "";
    const contentType = ct.toLowerCase();
    if (contentType.startsWith("video/")) return true;

    const ext = getExt(att.filename);
    return ext ? isVideoExt(ext) : false;
}

function isImageUrl(url: string, includeGifs: boolean): boolean {
    if (!url || !/^https?:\/\//i.test(url)) return false;
    const ext = getExt(url.split("?")[0]);
    if (!ext) return false;
    if (!includeGifs && ext === "gif") return false;
    return IMAGE_EXTS.has(ext);
}

export type GalleryItem = {
    stableId: string; // messageId:url format for stable selection
    channelId: string;
    messageId: string;
    url: string;
    proxyUrl?: string;
    width?: number;
    height?: number;
    filename?: string;
    authorId?: string;
    authorName?: string; // Store username directly to avoid lookup issues
    timestamp?: string;
    isAnimated?: boolean;
    isVideo?: boolean;
    isEmbed?: boolean;
    embedUrl?: string; // For YouTube/Vimeo embeds
    contentType?: string;
};

export function extractImages(
    messages: any[],
    channelId: string,
    opts: { includeGifs: boolean; includeEmbeds: boolean; }
): GalleryItem[] {
    if (!messages || !Array.isArray(messages)) return [];

    const items: GalleryItem[] = [];

    for (const m of messages) {
        if (!m) continue;
        const messageId = m.id ? String(m.id) : "";
        if (!messageId) continue;

        const authorId = m.author && m.author.id ? String(m.author.id) : undefined;
        // Get username directly from message author to avoid lookup issues
        const authorName = m.author
            ? (m.author.global_name ?? m.author.globalName ?? m.author.username ?? undefined)
            : undefined;
        const timestamp = m.timestamp ? String(m.timestamp) : undefined;
        const base = {
            channelId,
            messageId,
            authorId,
            authorName: authorName ? String(authorName) : undefined,
            timestamp
        };

        // Extract from attachments
        const { attachments } = m;
        if (Array.isArray(attachments)) {
            for (const a of attachments) {
                const url = String(a.url ?? "");
                if (!url) continue;

                const contentType = a.content_type ? String(a.content_type) : undefined;
                const filename = a.filename ? String(a.filename) : undefined;
                const ext = getExt(filename || url);
                const isVideo = isVideoAttachment(a);
                const isImage = isImageAttachment(a, opts.includeGifs);

                if (!isImage && !isVideo) continue;

                const proxyUrl = a.proxy_url ? String(a.proxy_url) : undefined;
                const width = typeof a.width === "number" ? a.width : undefined;
                const height = typeof a.height === "number" ? a.height : undefined;

                // Check if content is animated - handles GIFs, animated WebP, etc.
                const ctLower = contentType?.toLowerCase() ?? "";
                const animated = Boolean(
                    (ext && isAnimatedExt(ext)) ||
                    ctLower === "image/gif" ||
                    ctLower.startsWith("video/")
                );

                // Extract original URL
                const originalUrl = extractOriginalUrl(url);

                items.push({
                    ...base,
                    stableId: `${messageId}:${originalUrl}`,
                    url: originalUrl,
                    proxyUrl: proxyUrl ? extractOriginalUrl(proxyUrl) : undefined,
                    filename,
                    width,
                    height,
                    isAnimated: animated,
                    isVideo: isVideo,
                    contentType
                });
            }
        }

        // Extract from embeds
        if (opts.includeEmbeds) {
            let { embeds } = m;
            if (typeof embeds === "string") {
                try {
                    embeds = JSON.parse(embeds);
                } catch {
                    continue;
                }
            }
            if (Array.isArray(embeds)) {
                for (const e of embeds) {
                    if (!e) continue;
                    let embed = e;
                    if (typeof embed === "string") {
                        try {
                            embed = JSON.parse(embed);
                        } catch {
                            continue;
                        }
                    }

                    // Check for video embeds (YouTube, Vimeo, etc.)
                    const embedUrl = embed.url ? String(embed.url) : undefined;
                    const isVideoEmbed = embedUrl && (
                        embedUrl.includes("youtube.com") ||
                        embedUrl.includes("youtu.be") ||
                        embedUrl.includes("vimeo.com") ||
                        embedUrl.includes("twitch.tv")
                    );

                    if (isVideoEmbed) {
                        if (embedUrl && (embedUrl.includes("/clip/") || embedUrl.includes("youtube.com/clip"))) {
                            continue;
                        }
                        const thumb = embed?.thumbnail;
                        if (thumb?.url) {
                            const thumbUrl = String(thumb.url);
                            if (thumbUrl.includes("/clip/") || thumbUrl.includes("youtube.com/clip")) {
                                continue;
                            }
                            items.push({
                                ...base,
                                stableId: `${messageId}:${embedUrl}`,
                                url: embedUrl,
                                proxyUrl: thumb.proxyURL ? String(thumb.proxyURL) : (thumb.proxy_url ? String(thumb.proxy_url) : undefined),
                                width: typeof thumb.width === "number" ? thumb.width : undefined,
                                height: typeof thumb.height === "number" ? thumb.height : undefined,
                                filename: undefined,
                                isAnimated: true,
                                isVideo: true,
                                isEmbed: true,
                                embedUrl: embedUrl
                            });
                        }
                        continue;
                    }

                    // Handle video in embed
                    const { video } = embed;
                    if (video && video.url) {
                        const videoUrl = String(video.url);
                        const proxyUrl = video.proxyURL ? String(video.proxyURL) : (video.proxy_url ? String(video.proxy_url) : undefined);
                        const ext = getExt(videoUrl);
                        const isTenorStaticPng = isTenorStatic(videoUrl, video.content_type);

                        if (isTenorStaticPng) continue;

                        items.push({
                            ...base,
                            stableId: `${messageId}:${videoUrl}`,
                            url: extractOriginalUrl(videoUrl),
                            proxyUrl: proxyUrl ? extractOriginalUrl(proxyUrl) : undefined,
                            width: typeof video.width === "number" ? video.width : undefined,
                            height: typeof video.height === "number" ? video.height : undefined,
                            filename: undefined,
                            isAnimated: true,
                            isVideo: true,
                            contentType: video.content_type ? String(video.content_type) : undefined
                        });
                    }

                    // Handle images and thumbnails
                    const { image } = embed;
                    const thumb = embed.thumbnail;

                    for (const source of [image, thumb]) {
                        if (!source || !source.url) continue;
                        const url = String(source.url);

                        if (isTenorStatic(url, source.content_type)) continue;

                        if (!isImageUrl(url, opts.includeGifs)) continue;

                        const ext = getExt(url);
                        const ct = source.content_type ? String(source.content_type).toLowerCase() : "";
                        // Check if content is animated
                        let animated = false;
                        if (ext && isAnimatedExt(ext)) {
                            animated = true;
                        } else if (ct === "image/gif" || ct.startsWith("video/")) {
                            animated = true;
                        }
                        // Don't mark video files as animated images
                        if (ext && isVideoExt(ext)) {
                            animated = false;
                        }

                        items.push({
                            ...base,
                            stableId: `${messageId}:${extractOriginalUrl(url)}`,
                            url: extractOriginalUrl(url),
                            proxyUrl: source.proxyURL ? extractOriginalUrl(String(source.proxyURL)) : (source.proxy_url ? extractOriginalUrl(String(source.proxy_url)) : undefined),
                            width: typeof source.width === "number" ? source.width : undefined,
                            height: typeof source.height === "number" ? source.height : undefined,
                            filename: undefined,
                            isAnimated: animated,
                            contentType: source.content_type ? String(source.content_type) : undefined
                        });
                    }
                }
            }
        }
    }

    return items;
}

// Icon finder - try to find Discord's native gallery icon by code pattern
function findGalleryIcon(): React.ComponentType<any> | null {
    try {
        // Try to find the icon component by its unique code pattern
        // Looking for the specific SVG paths from Discord's gallery icon
        const byCode = findComponentByCodeLazy("M4 8v7.5a.5.5 0 0 1-.5.5H3a1 1 0 0 1-1-1V8a6 6 0 0 1 6-6h7a1 1 0 0 1 1 1v.5a.5.5 0 0 1-.5.5H8a4 4 0 0 0-4 4Z");
        if (byCode) return byCode;
    } catch {
        // Module not found, fall through to fallback
    }
    return null;
}

// Fallback SVG icon component - matches Discord's gallery icon design
function FallbackGalleryIcon(props: React.SVGProps<SVGSVGElement>) {
    const { width = 20, height = 20, ...restProps } = props;
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={width}
            height={height}
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
            {...restProps}
        >
            <path
                fill="currentColor"
                d="M4 8v7.5a.5.5 0 0 1-.5.5H3a1 1 0 0 1-1-1V8a6 6 0 0 1 6-6h7a1 1 0 0 1 1 1v.5a.5.5 0 0 1-.5.5H8a4 4 0 0 0-4 4Z"
            />
            <path
                fill="currentColor"
                fillRule="evenodd"
                d="M6 9a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V9Zm13.8 9.79L16.82 15a2 2 0 0 0-3.14 0l-2.09 2.65-.13-.16a1.5 1.5 0 0 0-2.36.05l-.95 1.26a.75.75 0 0 0 .6 1.2h10.46c.62 0 .97-.72.59-1.21ZM11.73 8.3c.57-.56 1.52-.01 1.33.77a.8.8 0 0 0 .55.96c.77.22.77 1.3 0 1.53a.8.8 0 0 0-.55.96c.19.77-.76 1.32-1.33.76a.8.8 0 0 0-1.1 0c-.58.56-1.53.01-1.33-.76a.8.8 0 0 0-.56-.96c-.77-.22-.77-1.31 0-1.53a.8.8 0 0 0 .56-.96c-.2-.78.75-1.33 1.32-.77.31.3.8.3 1.11 0Z"
                clipRule="evenodd"
            />
        </svg>
    );
}

// Export the icon component with fallback
const NativeIcon = findGalleryIcon();
export const GalleryIcon = NativeIcon || FallbackGalleryIcon;
