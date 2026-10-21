/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { CodecInfo } from "@vencord/discord-types";

const settings = definePluginSettings({
    disableAv1Codec: {
        description: "Make Discord not consider using AV1 for streaming and cameras.",
        type: OptionType.BOOLEAN,
        default: false
    },
    disableH265Codec: {
        description: "Make Discord not consider using H265 for streaming and cameras.",
        type: OptionType.BOOLEAN,
        default: false
    },
    disableH264Codec: {
        description: "Make Discord not consider using H264 for streaming and cameras.",
        type: OptionType.BOOLEAN,
        default: false
    },
    disableVP8Codec: {
        description: "Make Discord not consider using VP8 for streaming and cameras.",
        type: OptionType.BOOLEAN,
        default: false
    },
    disableVP9Codec: {
        description: "Make Discord not consider using VP9 for streaming and cameras.",
        type: OptionType.BOOLEAN,
        default: false
    },
});

export default definePlugin({
    name: "StreamingCodecDisabler",
    description: "Disable video codecs of your choice for streaming and cameras.",
    tags: ["Utility", "Voice"],
    authors: [EquicordDevs.davidkra230],
    settings,

    patches: [
        {
            find: "lastOverrideCodecDenylist.length",
            replacement: {
                match: /(let \i=)(\i\(\i\))(?=,\i=this\.lastOverrideCodecDenylist\.length)/,
                replace: "$1$self.filterCodecs($2)"
            },
        }
    ],

    filterCodecs(codecs: CodecInfo[]) {
        const disabled: Record<string, boolean> = {
            AV1: settings.store.disableAv1Codec,
            H265: settings.store.disableH265Codec,
            H264: settings.store.disableH264Codec,
            VP8: settings.store.disableVP8Codec,
            VP9: settings.store.disableVP9Codec,
        };
        return codecs.map(c => disabled[c.name] ? { ...c, encode: false } : c);
    },
});
