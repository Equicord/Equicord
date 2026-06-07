/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EffectDefinition } from "../types";

export const flickerEffect: EffectDefinition = {
    type: "flicker",
    name: "Flicker",
    frames: 4,
    afterDraw: (ctx, w, h, frameIndex) => {
        if (frameIndex % 2 === 1) {
            ctx.save();
            ctx.globalAlpha = 0.45;
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, w, h);
            ctx.restore();
        }
    },
};
