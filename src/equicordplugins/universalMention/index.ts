/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "UniversalMention",
    authors: [EquicordDevs.justjxke],
    description: "Mention any user, regardless of channel access.",

    patches: [
        {
            find: "queryChannelUsers({channelId:",
            replacement: {
                match: /filter:(\i)=>(\i)\.isPrivate\(\)\|\|(\i)\.BT\({permission:(\i)\.Plq\.VIEW_CHANNEL,user:\1,context:\2}\)/,
                replace: "filter:$1=>true",
            },
        },
    ],
});

// holy shit, a simple justjxke plugin? can't be real!
