/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { Forms } from "@webpack/common";

export default definePlugin({
    name: "QuestFocused",
    description: "Prevent the quests player from pausing and possibly skip it all together.",
    settingsAboutComponent: () => <>
        <Forms.FormText className="plugin-warning">
        You might need to spam left mouse button on the video to skip it.
        </Forms.FormText>
        </>,
    authors: [Devs.secp192k1],
    patches: [
        // Block pausing
        {
            find: "[QV] | updatePlayerState | playerState",
            replacement: {
                match: /(case \w+\.rq\.PAUSED:.*?)\w+\.current\.pause\(\),/,
                replace: "$1"
            }
        },
        {
            find: "[QV] | updatePlayerState | playerState:",
            replacement: {
                match: /(case \w+\.rq\.PLAYING:)\w+\.current\.paused/,
                replace: "$1!1"
            }
        },
    ],
});
