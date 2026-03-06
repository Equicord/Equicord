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

export interface RenderColors {
    text?: string;
    operator?: string;
    equals?: string;
}

type RenderSurface = OffscreenCanvas;
type RenderContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function measureText(ctx: RenderContext, text: string): number {
    ctx.font = FONT;
    return ctx.measureText(text).width;
}

interface TextSegment {
    text: string;
    color: string;
}

function getRenderColors(colors?: RenderColors) {
    return {
        text: colors?.text?.trim() ?? TEXT_COLOR,
        operator: colors?.operator?.trim() ?? OP_COLOR,
        equals: colors?.equals?.trim() ?? EQ_COLOR,
    };
}

function segmentExpression(text: string, colors?: RenderColors): TextSegment[] {
    const resolvedColors = getRenderColors(colors);
    const segments: TextSegment[] = [];
    const regex = /(=)|([-+*/%^])|([^=+*/%^-]+)/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
        if (match[1]) {
            segments.push({ text: " = ", color: resolvedColors.equals });
        } else if (match[2]) {
            segments.push({ text: ` ${match[2]} `, color: resolvedColors.operator });
        } else if (match[3]) {
            segments.push({ text: match[3], color: resolvedColors.text });
        }
    }

    return segments;
}

export function renderMathToCanvas(expression: string, steps?: string, colors?: RenderColors): RenderSurface {
    // Determine content
    const displayText = steps || expression;
    const lines = displayText.split("\n");

    const measureCanvas = new OffscreenCanvas(1, 1);
    const measureCtx = measureCanvas.getContext("2d");
    if (!measureCtx) throw new Error("Failed to create canvas context");

    // Measure
    let maxWidth = 0;
    for (const line of lines) {
        const w = measureText(measureCtx, line.replace(/\\\*/g, "*")) + PADDING * 2;
        if (w > maxWidth) maxWidth = w;
    }

    const canvas = new OffscreenCanvas(maxWidth + PADDING, lines.length * LINE_HEIGHT + PADDING * 2);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to create canvas context");

    canvas.width = maxWidth + PADDING;
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
        const segments = segmentExpression(line, colors);

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

export async function canvasToBlob(canvas: RenderSurface): Promise<Blob> {
    return canvas.convertToBlob({ type: "image/png" });
}
