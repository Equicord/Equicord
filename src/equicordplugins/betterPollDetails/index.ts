/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "BetterPollDetails",
    description: "Shows poll percentages and vote counts before voting or expiration without disabling the ability to vote",
    authors: [EquicordDevs.lethied],
    tags: ["Chat", "Utility"],
    patches: [
        {
            find: 'containerStyle:"normal"',
            replacement: [
                {
                    match: /(?<=canRemoveVote:[^,}]*&&[^,}]*,)canShowVoteCounts:\i/,
                    replace: "canShowVoteCounts:true"
                },
                {
                    match: /(?<=secondaryAction:\i,tertiaryAction:)\i/,
                    replace: "$self.getTertiaryAction($&)"
                }
            ]
        }
    ],
    getTertiaryAction() {
        return void 0;
    }
});
