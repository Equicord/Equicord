/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export function parseHexColor(hex: string, fallback: string): string {
    const v = hex.trim();
    return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v) ? v : fallback;
}

function hexToRgb(hex: string): { r: number; g: number; b: number; } {
    const h = parseHexColor(hex, "#000000").replace("#", "");
    const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
    const n = parseInt(full, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgba(hex: string, opacityPercent: number): string {
    const { r, g, b } = hexToRgb(hex);
    const a = Math.max(0, Math.min(100, opacityPercent)) / 100;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export const hexToInt = (hex: string): number => parseInt(parseHexColor(hex, "#000000").replace("#", ""), 16);
export const intToHex = (n: number): string => "#" + n.toString(16).padStart(6, "0");
