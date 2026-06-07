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

export type EffectType = "pulse" | "flicker";

export interface EffectDefinition {
    type: EffectType;
    name: string;
    frames: number;
    beforeDraw?: (ctx: CanvasRenderingContext2D, width: number, height: number, frameIndex: number, totalFrames: number) => void;
    afterDraw?: (ctx: CanvasRenderingContext2D, width: number, height: number, frameIndex: number, totalFrames: number) => void;
}

export interface GifMakerOptions {
    width: number;
    height: number;
    frameDelay: number;
    grayscale: boolean;
    effectTypes: EffectType[];
    captionMode: CaptionMode;
    captionText: string;
    captionSize: number;
    bubbleTipX: number;
    bubbleTipY: number;
    bubbleTipBase: number;
}

export const DEFAULT_OPTIONS: GifMakerOptions = {
    width: 256,
    height: 256,
    frameDelay: 100,
    grayscale: false,
    effectTypes: [],
    captionMode: "none",
    captionText: "",
    captionSize: 40,
    bubbleTipX: 80,
    bubbleTipY: 80,
    bubbleTipBase: 0.1,
};
