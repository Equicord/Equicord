/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Renders a math expression or step-by-step breakdown as a PNG image
// using the Canvas API.

const FONT_SIZE = 18;
const PADDING = 20;
const LINE_HEIGHT = FONT_SIZE * 1.5;
const FONT = `${FONT_SIZE}px "Cambria Math", "Latin Modern Math", "STIX Two Math", serif`;
const BG_COLOR = "#00000000";
const TEXT_COLOR = "#e0e0e0";
const OP_COLOR = "#7289da";
const EQ_COLOR = "#57f287";

function measureText(ctx: CanvasRenderingContext2D, text: string): number {
    ctx.font = FONT;
    return ctx.measureText(text).width;
}

interface TextSegment {
    text: string;
    color: string;
}

function segmentExpression(text: string): TextSegment[] {
    const segments: TextSegment[] = [];
    const regex = /(=)|([+\-\\\*\/%\^])|([^=+\-\\\*\/%\^]+)/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
        if (match[1]) {
            segments.push({ text: " = ", color: EQ_COLOR });
        } else if (match[2]) {
            segments.push({ text: match[2], color: OP_COLOR });
        } else if (match[3]) {
            segments.push({ text: match[3], color: TEXT_COLOR });
        }
    }

    return segments;
}

export function renderMathToCanvas(expression: string, steps?: string): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;

    // Determine content
    const displayText = steps || expression;
    const lines = displayText.split("\n");

    // Measure
    ctx.font = FONT;
    let maxWidth = 0;
    for (const line of lines) {
        const w = measureText(ctx, line.replace(/\\\*/g, "*"));
        if (w > maxWidth) maxWidth = w;
    }

    canvas.width = maxWidth + PADDING * 2;
    canvas.height = lines.length * LINE_HEIGHT + PADDING * 2;

    // Background
    ctx.fillStyle = BG_COLOR;
    ctx.beginPath();
    const r = 12;
    const w = canvas.width;
    const h = canvas.height;
    ctx.moveTo(r, 0);
    ctx.arcTo(w, 0, w, h, r);
    ctx.arcTo(w, h, 0, h, r);
    ctx.arcTo(0, h, 0, 0, r);
    ctx.arcTo(0, 0, w, 0, r);
    ctx.closePath();
    ctx.fill();

    // Render text
    ctx.textBaseline = "middle";

    for (let i = 0; i < lines.length; i++) {
        const y = PADDING + i * LINE_HEIGHT + LINE_HEIGHT / 2;
        const line = lines[i].replace(/\\\*/g, "*");
        const segments = segmentExpression(line);

        let x = PADDING;
        for (const seg of segments) {
            ctx.font = FONT;
            ctx.fillStyle = seg.color;
            ctx.fillText(seg.text, x, y);
            x += measureText(ctx, seg.text);
        }
    }

    return canvas;
}

export async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
            if (blob) resolve(blob);
            else reject(new Error("Failed to create image"));
        }, "image/png");
    });
}
