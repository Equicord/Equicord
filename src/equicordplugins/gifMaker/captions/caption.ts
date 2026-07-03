/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { getCanvasFont } from "../fonts";
import type { CaptionDefinition } from "../types";

type MeasureResult = { lines: string[]; lineHeight: number; };

export function measureTextLines(ctx: CanvasRenderingContext2D, text: string, fontSize: number, fontFamily: string, maxWidth: number): MeasureResult {
    ctx.font = getCanvasFont(fontSize, fontFamily);
    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    }
    if (currentLine) lines.push(currentLine);

    return { lines, lineHeight: fontSize * 1.2 };
}

export const captionCaption: CaptionDefinition = {
    type: "caption",
    name: "Caption",
    render: (ctx, width, captionHeight, options) => {
        const { captionText, captionSize, fontFamily } = options;
        if (!captionText || captionHeight <= 0) return;

        const maxWidth = width - 20;
        const { lines, lineHeight } = measureTextLines(ctx, captionText, captionSize, fontFamily, maxWidth);
        const padding = 10;
        const areaHeight = lines.length * lineHeight + padding * 2;

        const drawY = (captionHeight - areaHeight) / 2;

        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, width, captionHeight);

        ctx.fillStyle = "black";
        ctx.font = getCanvasFont(captionSize, fontFamily);
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], width / 2, drawY + padding + i * lineHeight);
        }
    },
};
