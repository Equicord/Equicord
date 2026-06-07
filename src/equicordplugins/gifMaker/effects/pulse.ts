/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EffectDefinition } from "../types";

export const pulseEffect: EffectDefinition = {
    type: "pulse",
    name: "Pulse",
    frames: 3,
    beforeDraw: (ctx, w, h, frameIndex) => {
        const scales = [1, 0.95, 1];
        const s = scales[frameIndex % 3];
        const ox = (w - w * s) / 2;
        const oy = (h - h * s) / 2;
        ctx.translate(ox, oy);
        ctx.scale(s, s);
    },
};
