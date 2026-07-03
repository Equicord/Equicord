/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Based on https://github.com/TheLazySquid/BetterDiscordPlugins/blob/main/plugins/GifCaptioner/src/render/speechbubble.ts

import type { CaptionDefinition } from "../types";

type Point = [number, number];

// https://stackoverflow.com/a/5634528
function bezierPoint(t: number, start: Point, control: Point, end: Point): Point {
    const x = (1 - t) * (1 - t) * start[0] + 2 * (1 - t) * t * control[0] + t * t * end[0];
    const y = (1 - t) * (1 - t) * start[1] + 2 * (1 - t) * t * control[1] + t * t * end[1];

    return [x, y];
}

function moveAway(point: Point, from: Point, distance: number): Point {
    const dx = point[0] - from[0];
    const dy = point[1] - from[1];
    const length = Math.sqrt(dx ** 2 + dy ** 2);
    if (length === 0) return point;
    const scale = distance / length;

    return [point[0] + dx * scale, point[1] + dy * scale];
}

export function renderSpeechbubble(ctx: CanvasRenderingContext2D, width: number, height: number,
    tipX: number, tipY: number, tipBase: number) {
    const start: Point = [0, height * 0.1];
    const control: Point = [width * 0.5, height * 0.2];
    const end: Point = [width, height * 0.1];

    // Fill the top (gentle arc left to right 10% of the height down)
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(...start);
    ctx.quadraticCurveTo(...control, ...end);
    ctx.lineTo(width, 0);
    ctx.lineTo(0, 0);
    ctx.fillStyle = "white";
    ctx.fill();

    // Add the bottom stroke
    ctx.beginPath();
    ctx.moveTo(...start);
    ctx.quadraticCurveTo(...control, ...end);
    ctx.strokeStyle = "black";
    ctx.lineWidth = 2;
    ctx.stroke();

    const tipWidth = 0.2;
    const base1 = bezierPoint(tipBase, start, control, end);
    const base2 = bezierPoint(tipBase + tipWidth, start, control, end);
    const tip: Point = [tipX, tipY];

    // Draw the tip's background
    const bgDistance = 5;
    ctx.beginPath();
    ctx.moveTo(...moveAway(base1, tip, bgDistance));
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(...moveAway(base2, tip, bgDistance));
    ctx.fillStyle = "white";
    ctx.fill();

    // Draw the tip's outline
    ctx.beginPath();
    ctx.moveTo(...base1);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(...base2);
    ctx.strokeStyle = "black";
    ctx.lineWidth = 2;
    ctx.stroke();
}

export const speechbubbleCaption: CaptionDefinition = {
    type: "speechbubble",
    name: "Bubble",
    render: (ctx, width, height, options) => {
        renderSpeechbubble(ctx, width, height, options.bubbleTipX, options.bubbleTipY, options.bubbleTipBase);
    },
};
