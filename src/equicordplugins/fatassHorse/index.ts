/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import horse from "file://horse.js";

const settings = definePluginSettings({
    speed: {
        description: "Speed of the horse",
        type: OptionType.NUMBER,
        default: 30,
        isValid: (v: number) => v > 0 || "Speed must be larger than 0",
        onChange: load
    },
    fps: {
        description: "Framerate of the horse",
        type: OptionType.NUMBER,
        default: 24,
        isValid: (v: number) => v > 0 || "Framerate must be larger than 0",
        onChange: load
    },
    size: {
        description: "Size of the horse",
        type: OptionType.NUMBER,
        default: 120,
        isValid: (v: number) => v > 0 || "Size must be larger than 0",
        onChange: load
    },
    fade: {
        description: "If the horse should fade when the cursor is near",
        type: OptionType.BOOLEAN,
        default: true,
        onChange: load
    },
    freeroam: {
        description: "If the horse should roam freely when idle",
        type: OptionType.BOOLEAN,
        default: true,
        onChange: load
    },
    shake: {
        description: "If the horse should shake the window when it's walking",
        type: OptionType.BOOLEAN,
        default: false,
        onChange: load
    }
});

function load() {
    if (!Vencord.Plugins.isPluginEnabled("FatassHorse")) return;

    (0, eval)(horse)({
        speed: settings.store.speed,
        fps: settings.store.fps,
        size: settings.store.size,
        fade: settings.store.fade,
        freeroam: settings.store.freeroam,
        shake: settings.store.shake
    });
}

export default definePlugin({
    name: "FatassHorse",
    description: "What a fatass horse",
    authors: [EquicordDevs.nexpid],
    settings,

    start: load,
    stop() {
        document.getElementById("fathorse")?.remove();
    }
});
