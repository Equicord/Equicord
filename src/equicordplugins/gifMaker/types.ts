/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export type CaptionMode = "none" | "caption" | "speechbubble";

export interface CaptionDefinition {
    type: CaptionMode;
    name: string;
    render: (ctx: CanvasRenderingContext2D, width: number, height: number, options: GifMakerOptions) => void;
}

export interface GifMakerOptions {
    width: number;
    height: number;
    captionMode: CaptionMode;
    captionText: string;
    captionSize: number;
    fontFamily: string;
    bubbleTipX: number;
    bubbleTipY: number;
    bubbleTipBase: number;
}

export const DEFAULT_OPTIONS: GifMakerOptions = {
    width: 256,
    height: 256,
    captionMode: "none",
    captionText: "",
    captionSize: 40,
    fontFamily: "Arial",
    bubbleTipX: 80,
    bubbleTipY: 80,
    bubbleTipBase: 0.1,
};

export interface GoogleFontAxis {
    tag: string;
    min: number;
    max: number;
}

export interface GoogleFontVariant {
    axes: GoogleFontAxis[];
}

export interface GoogleFontMetadata {
    family: string;
    displayName: string;
    authors: string[];
    category?: number;
    popularity?: number;
    variants: GoogleFontVariant[];
}
