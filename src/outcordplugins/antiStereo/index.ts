/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin from "@utils/types"

export default definePlugin({
    name: "AntiStereo",
    description: "Force Discord à utiliser le mono au lieu de la stéréo en sortie audio.",
    tags: ["Voice", "Accessibility"],
    authors: [{ name: "Bash", id: 1327483363518582784n }],
    requiresRestart: true,

    patches: [
        {
            find: "Audio codecs",
            replacement: {
                match: /channels:\d+(?:\.\d+)?,/,
                replace: "channels:1,",
            },
        },
        {
            find: "stereo",
            replacement: {
                match: /stereo:\s*["']?\d+(?:\.\d+)?["']?/g,
                replace: "stereo:false",
            },
        },
        {
            find: "AudioContext",
            replacement: {
                match: /sampleRate:\s*\d+/g,
                replace: "sampleRate:48000",
            },
        },
    ],
})
