/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

import { syncMixerGains } from "./mixer";

export const settings = definePluginSettings({
    hookAllSoundboardSounds: {
        type: OptionType.BOOLEAN,
        description: "Hook all soundboard sounds. If disabled, only hooks sounds you don't have access to (Nitro-locked sounds).",
        default: false,
    },
    hookPreview: {
        type: OptionType.BOOLEAN,
        description: "Hook eligible soundboard preview sounds. If disabled, only the play button is hooked.",
        default: true,
    },
    micVolume: {
        type: OptionType.SLIDER,
        description: "Real microphone volume while a routed soundboard sound is playing.",
        markers: [0, 25, 50, 75, 100],
        default: 100,
        stickToMarkers: false,
        onChange: () => syncMixerGains(),
    },
    soundVolume: {
        type: OptionType.SLIDER,
        description: "Soundboard volume mixed into microphone.",
        markers: [0, 25, 50, 75, 100],
        default: 100,
        stickToMarkers: false,
        onChange: () => syncMixerGains(),
    },
    keepLocalPlayback: {
        type: OptionType.BOOLEAN,
        description: "Keep routed soundboard audio audible locally.",
        default: true,
    },
});
