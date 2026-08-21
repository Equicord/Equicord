/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Moment } from "moment";

export interface WebhookField {
    key: string;
    name: string;
    value: string;
    inline: boolean;
}

export interface WebhookAuthor {
    name: string;
    url?: string;
    icon_url?: string;
}

export interface WebhookFooter {
    text: string;
    icon_url?: string;
}

export interface WebhookEmbed {
    title?: string;
    description?: string;
    url?: string;
    color?: number;
    timestamp?: string;
    author?: WebhookAuthor;
    thumbnail?: { url: string; };
    image?: { url: string; };
    footer?: WebhookFooter;
    fields: WebhookField[];
}

export interface PreviewMedia {
    url: string;
    proxyURL?: string;
    width?: number;
    height?: number;
}

export interface PreviewEmbed {
    id: string;
    url?: string;
    rawTitle?: string;
    rawDescription?: string;
    color?: string;
    author?: {
        name: string;
        url?: string;
        iconURL?: string;
        iconProxyURL?: string;
    };
    footer?: {
        text: string;
        iconURL?: string;
        iconProxyURL?: string;
    };
    timestamp?: Moment;
    thumbnail?: PreviewMedia;
    image?: PreviewMedia;
    fields: {
        rawName: string;
        rawValue: string;
        inline: boolean;
    }[];
}

export interface EmbedAsset {
    label: string;
    url: string;
    proxyURL?: string;
}
