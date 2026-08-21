/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export const settings = definePluginSettings({
    theme: {
        type: OptionType.SELECT,
        description: "Theme used by the voice status popout window.",
        options: [
            { label: "Match Discord", value: "match", default: true },
            { label: "Always dark", value: "dark" },
            { label: "Always light", value: "light" }
        ]
    },
    cardOpacity: {
        type: OptionType.SLIDER,
        description: "Opacity of the panel's card sections (columns, staff actions, activity log).",
        markers: [0, 25, 50, 75, 100],
        default: 60,
        stickToMarkers: false
    }
});
