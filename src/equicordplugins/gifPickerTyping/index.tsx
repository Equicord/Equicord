/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { Constants, ExpressionPickerStore, RestAPI, useEffect } from "@webpack/common";

export default definePlugin({
    name: "GifPickerTyping",
    description: "Shows you as typing while the GIF picker is open, so nobody wonders why you went quiet.",
    authors: [EquicordDevs.luqenov],

    patches: [
        {
            find: "renderHeaderContent()",
            replacement: {
                match: /(?<=function \i\(\i\)\{let\{ref:\i,\.\.\.\i\}=\i;)(?=\i\.useEffect\(\(\)=>\(\i\.persistSearch)/,
                replace: "$self.useGifPickerTyping();"
            }
        }
    ],

    useGifPickerTyping() {
        const channelId = ExpressionPickerStore.useExpressionPickerStore(state => state.activeChannelId);

        useEffect(() => {
            if (!channelId) return;

            const type = () => RestAPI.post({ url: Constants.Endpoints.TYPING(channelId) });
            type();

            const interval = setInterval(type, 8000);
            return () => clearInterval(interval);
        }, [channelId]);
    }
});