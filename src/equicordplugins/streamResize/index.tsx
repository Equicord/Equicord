/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { makeRange, OptionType } from "@utils/types";

import { Bounds, computeBounds } from "./bounds";

export const settings = definePluginSettings({
    minPct: {
        description: "Minimum PIP size (% of screen)",
        type: OptionType.SLIDER,
        markers: makeRange(10, 90, 5),
        default: 20,
        stickToMarkers: false,
    },
    maxPct: {
        description: "Maximum PIP size (% of the screen)",
        type: OptionType.SLIDER,
        markers: makeRange(20, 100, 5),
        default: 90,
        stickToMarkers: false,
    },
});

export default definePlugin({
    name: "StreamResize",
    description:
        "Extend the min/max resize limits of the PIP stream window (keep 16:9)",
    authors: [EquicordDevs.Skaikru0518],
    settings,

    getBounds(): Bounds {
        return computeBounds(
            window.innerWidth,
            window.innerHeight,
            settings.store.minPct,
            settings.store.maxPct,
        );
    },

    patches: [
        {
            find: "40*Math.round(",
            replacement: [
                {
                    // clamp on resize end (final width)
                    match: /(=40\*Math\.round\(\i\/40\);return\(0,\i\.clamp\)\(\i,)\i\.minWidth,\i\.maxWidth\)/,
                    replace:
                        "$1$self.getBounds().min.w,$self.getBounds().max.w)",
                },
                {
                    // live drag constraint (hard limit while dragging)
                    match: /minDimension:\i\.minWidth,maxDimension:\i\.maxWidth\+20/,
                    replace:
                        "minDimension:$self.getBounds().min.w,maxDimension:$self.getBounds().max.w",
                },
            ],
        },
    ],
});
