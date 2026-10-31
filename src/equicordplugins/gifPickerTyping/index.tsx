/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { Constants, RestAPI, SelectedChannelStore } from "@webpack/common";

let interval: ReturnType<typeof setInterval> | undefined;

function sendTyping() {
    const channelId = SelectedChannelStore.getChannelId();
    if (channelId) RestAPI.post({ url: Constants.Endpoints.TYPING(channelId) });
}

export default definePlugin({
    name: "GifPickerTyping",
    description: "Shows you as typing while the GIF picker is open, so nobody wonders why you went quiet.",
    authors: [EquicordDevs.luqenov],

    patches: [
        {
            find: "renderHeaderContent()",
            replacement: [
                {
                    match: /componentDidMount\(\)\{(?=\i\.\i\(\),document\.addEventListener\("keydown",this\.backToFrontPage\))/,
                    replace: "$&$self.startTyping(),"
                },
                {
                    match: /componentWillUnmount\(\)\{(?=\i\.\i\(\),document\.removeEventListener\("keydown",this\.backToFrontPage\))/,
                    replace: "$&$self.stopTyping(),"
                }
            ]
        }
    ],

    startTyping() {
        clearInterval(interval);
        sendTyping();
        interval = setInterval(sendTyping, 8000);
    },

    stopTyping() {
        clearInterval(interval);
        interval = undefined;
    },

    stop() {
        this.stopTyping();
    }
});