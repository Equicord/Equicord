/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { ComponentDispatch } from "@webpack/common";

let lastChannelId: string | null = null;

// credits to prism for removing useless pieces of code 
export default definePlugin({
    name: "AutoJump",
    description: "Automatically jump to the bottom when switching channels.",
    authors: [EquicordDevs.omaw],
    flux: {
        CHANNEL_SELECT({ channelId, messageId }) {
            if (!channelId || messageId || lastChannelId === channelId) return;
            lastChannelId = channelId;
            ComponentDispatch.dispatch("SCROLLTO_PRESENT");
        }
    }
});


