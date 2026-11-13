/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";

export const settings = definePluginSettings({
    hideShowResultsButton: {
        type: OptionType.BOOLEAN,
        description: "Hide the 'Show results' button since results are already visible",
        default: true
    }
});

export default definePlugin({
    name: "BetterPollDetails",
    description: "Shows poll percentages and vote counts before voting or expiration without disabling the ability to vote",
    authors: [EquicordDevs.lethied],
    tags: ["Chat", "Utility"],
    settings,

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

    getTertiaryAction(orig: unknown) {
        return settings.store.hideShowResultsButton ? void 0 : orig;
    }
});

