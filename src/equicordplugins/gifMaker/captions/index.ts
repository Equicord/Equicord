/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { CaptionDefinition } from "../types";
import { captionCaption } from "./caption";
import { noneCaption } from "./none";
import { speechbubbleCaption } from "./speechbubble";

export const CAPTIONS: CaptionDefinition[] = [
    noneCaption,
    captionCaption,
    speechbubbleCaption,
];
