/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { CaptionDefinition } from "../types";

type Point = [number, number];

function bezierPoint(t: number, start: Point, control: Point, end: Point): Point {
    const x = (1 - t) * (1 - t) * start[0] + 2 * (1 - t) * t * control[0] + t * t * end[0];
    const y = (1 - t) * (1 - t) * start[1] + 2 * (1 - t) * t * control[1] + t * t * end[1];
    return [x, y];
}

function moveAway(point: Point, from: Point, distance: number): Point {
    const dx = point[0] - from[0];
    const dy = point[1] - from[1];
    const length = Math.sqrt(dx ** 2 + dy ** 2);
    const scale = distance / length;
    return [point[0] + dx * scale, point[1] + dy * scale];
}

export const speechbubbleCaption: CaptionDefinition = {
    type: "speechbubble",
    name: "Bubble",
    render: (ctx, width, captionHeight, options) => {
        if (captionHeight <= 0) return;

        const { bubbleTipX, bubbleTipY, bubbleTipBase } = options;
        const w = width;
        const h = captionHeight;

        const start: Point = [0, h];
        const control: Point = [w * 0.5, h * 0.8];
        const end: Point = [w, h];

        // Fill the caption area from top to the curved bottom edge
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(...start);
        ctx.quadraticCurveTo(...control, ...end);
        ctx.lineTo(w, 0);
        ctx.closePath();
        ctx.fillStyle = "white";
        ctx.fill();

        // Stroke the curved bottom edge
        ctx.beginPath();
        ctx.moveTo(...start);
        ctx.quadraticCurveTo(...control, ...end);
        ctx.strokeStyle = "black";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Tip extending from the curve into the image
        const tipWidth = 0.2;
        const base1 = bezierPoint(bubbleTipBase, start, control, end);
        const base2 = bezierPoint(bubbleTipBase + tipWidth, start, control, end);
        const tip: Point = [bubbleTipX, h + bubbleTipY];

        // White tip background (wider for clean edges)
        const bgDist = 5;
        ctx.beginPath();
        ctx.moveTo(...moveAway(base1, tip, bgDist));
        ctx.lineTo(...tip);
        ctx.lineTo(...moveAway(base2, tip, bgDist));
        ctx.fillStyle = "white";
        ctx.fill();

        // Black tip outline
        ctx.beginPath();
        ctx.moveTo(...base1);
        ctx.lineTo(...tip);
        ctx.lineTo(...base2);
        ctx.strokeStyle = "black";
        ctx.lineWidth = 2;
        ctx.stroke();
    },
};
