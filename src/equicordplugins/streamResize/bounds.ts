/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export const ASPECT_RATIO = 16 / 9;

export interface Size {
    w: number;
    h: number;
}
export interface Bounds {
    min: Size;
    max: Size;
}

const FALLBACK: Bounds = {
    min: { w: 320, h: 180 },
    max: { w: 1280, h: 720 },
};

export function sizeForPct(
    screenW: number,
    screenH: number,
    pct: number,
): Size {
    const p = pct / 100;
    const wByWidth = screenW * p;
    const wByHeight = screenH * p * ASPECT_RATIO;
    const w = Math.min(wByWidth, wByHeight);
    return { w, h: w / ASPECT_RATIO };
}

export function computeBounds(
    screenW: number,
    screenH: number,
    minPct: number,
    maxPct: number,
): Bounds {
    if (!screenW || !screenH) return FALLBACK;
    const lo = Math.min(minPct, maxPct);
    const hi = Math.max(minPct, maxPct);
    return {
        min: sizeForPct(screenW, screenH, lo),
        max: sizeForPct(screenW, screenH, hi),
    };
}
