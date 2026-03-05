/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { get, set } from "@api/DataStore";
import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { Channel } from "@vencord/discord-types";
import { FluxDispatcher } from "@webpack/common";

const STORE_KEY = "DMKeeper_channels";

const isDM = (channel: Channel) => channel.type === 1 || channel.type === 3;

let storedChannels: Record<string, Channel> = {};

const interceptor = (action: { type: string; channel?: Channel; private_channels?: Channel[]; }) => {
    if (action.type === "CHANNEL_DELETE" && action.channel && isDM(action.channel))
        return true;

    if (action.type === "CHANNEL_CREATE" && action.channel && isDM(action.channel)) {
        storedChannels[action.channel.id] = action.channel;
        set(STORE_KEY, storedChannels);
    }

    if (action.type === "READY" && action.private_channels) {
        const existing = new Set(action.private_channels.map(c => c.id));
        for (const channel of Object.values(storedChannels))
            if (!existing.has(channel.id))
                action.private_channels.push(channel);
    }
};

export default definePlugin({
    name: "DMKeeper",
    description: "Prevents Discord from automatically hiding old DM conversations from your sidebar.",
    authors: [EquicordDevs.Awizz],

    async start() {
        storedChannels = await get<Record<string, Channel>>(STORE_KEY) ?? {};
        FluxDispatcher.addInterceptor(interceptor);
    },

    stop() {
        FluxDispatcher.removeInterceptor(interceptor);
        storedChannels = {};
    },
});
