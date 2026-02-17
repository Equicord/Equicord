/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export const settings = definePluginSettings({
    avatarSlots: {
        type: OptionType.SLIDER,
        description: "How many avatar slots to keep.",
        default: 12,
        markers: [6, 12, 24, 36, 48, 60],
        minValue: 6,
        maxValue: 60,
        stickToMarkers: true
    },
    bannerSlots: {
        type: OptionType.SLIDER,
        description: "How many banner slots to keep.",
        default: 12,
        markers: [6, 12, 24, 36, 48, 60],
        minValue: 6,
        maxValue: 60,
        stickToMarkers: true
    }
});
