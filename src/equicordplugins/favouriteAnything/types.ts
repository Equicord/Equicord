/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EmbedJSON, MessageAttachment } from "@vencord/discord-types";
import { PropsWithChildren } from "react";
import { JsonValue, PartialDeep } from "type-fest";

export enum ExpressionPickerView {
    EMOJI = "emoji",
    GIF = "gif",
    STICKER = "sticker",
    SOUNDBOARD = "soundboard",
    FILES = "files"
}

export interface ExpressionPickerTabProps extends PropsWithChildren {
    id?: string;
    "aria-controls"?: string;
    "aria-selected"?: boolean;
    isActive?: boolean;
    viewType: ExpressionPickerView;
}

export interface AttachmentItem {
    contentType: string;
    type: "IMAGE" | "VIDEO" | "CLIP" | "AUDIO" | "VISUAL_PLACEHOLDER" | "PLAINTEXT_PREVIEW" | "OTHER" | "INVALID";
    width?: number;
    height?: number;
    downloadUrl: string;
    spoiler: boolean;
    srcIsAnimated: boolean;
    uniqueId: string;
    originalItem: MessageAttachment;
}

export enum FavouriteItemFormat {
    NONE = 0,
    IMAGE = 1,
    VIDEO = 2
}

export interface FavouriteItem {
    format: FavouriteItemFormat;
    src: string;
    width: number;
    height: number;
    order: number;
}

export enum CustomItemFormat {
    ATTACHMENT = 0
}

export interface CustomItemDef<A = any, B extends JsonValue = any> {
    encode: (data: A) => B | null;
    decode: (data: PartialDeep<B, { recurseIntoArrays: true; }>) => NoInfer<A> | null;
    stringify: (data: A) => string;
}

export type ItemsDef<T> = T & {
    [K in keyof T]: T[K] extends CustomItemDef<infer A, infer B> ? CustomItemDef<A, B> : never;
};

export interface RefreshedUrlsResponse {
    refreshed_urls: [
        {
            original: string;
            refreshed: string | null;
        }
    ];
}

export interface UnfurledEmbedsResponse {
    embeds: EmbedJSON[];
}
