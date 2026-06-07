/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EffectDefinition } from "../types";
import { flickerEffect } from "./flicker";
import { pulseEffect } from "./pulse";

export const EFFECTS: EffectDefinition[] = [
    pulseEffect,
    flickerEffect,
];
