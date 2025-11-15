/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */


import * as DataStore from "@api/DataStore";
import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { FluxDispatcher, UserStore, ChannelStore, VoiceStateStore } from "@webpack/common";

const DATASTORE_KEY = "VCLastVoiceChannel";
const DATASTORE_SESSION_KEY = "VCLastVoiceChannelSession";

interface SavedVoiceChannel {
    guildId: string | null;
    channelId: string;
}

const settings = definePluginSettings({
    rejoinDelay: {
        type: OptionType.SELECT,
        description: "Set Delay before rejoining voice channel.",
        options: [
            { label: "1 Second", value: 1000, default: false },
            { label: "2 Seconds", value: 2000, default: true },
            { label: "3 Seconds", value: 3000, default: false },
            { label: "5 Seconds", value: 5000, default: false },
        ],
    },
    preventReconnectIfCallEnded: {
        type: OptionType.BOOLEAN,
        description: "Do not reconnect if the call has ended or the voice channel is empty or does not exist.",
        default: true,
    },
});

export default definePlugin({
    name: "VoiceRejoin",
    description: "Rejoins DM/Server call automatically when restarting Discord.",
    authors: [EquicordDevs.omaw],
    settings,

    flux: {
        VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: any[]; }) {
            const myUserId = UserStore?.getCurrentUser?.()?.id;
            if (!myUserId) return;

            const myState = voiceStates.find(s => s.userId === myUserId);
            if (!myState) return;

            if (myState.channelId) {
                const saved: SavedVoiceChannel = {
                    guildId: myState.guildId ?? null,
                    channelId: myState.channelId,
                };
                DataStore.set(DATASTORE_KEY, saved);
                DataStore.set(DATASTORE_SESSION_KEY, true);
            } else {
                DataStore.set(DATASTORE_SESSION_KEY, false);
            }
        },

        async CONNECTION_OPEN() {
            const wasInVC = await DataStore.get<boolean>(DATASTORE_SESSION_KEY);
            if (wasInVC === false) {
                DataStore.del(DATASTORE_KEY);
                return;
            }

            setTimeout(async () => {
                const saved = await DataStore.get<SavedVoiceChannel>(DATASTORE_KEY);
                if (!saved?.channelId) return;
                 if (settings.store.preventReconnectIfCallEnded) { // credits to miamlya for this fix
                    const channel = ChannelStore.getChannel(saved.channelId);

                    if (!channel) {
                        DataStore.set(DATASTORE_SESSION_KEY, false);
                        return;
                    }

                    const connectedUsers = VoiceStateStore.getVoiceStatesForChannel(saved.channelId);
                    const othersInCall = Object.values(connectedUsers).filter(
                        (vs: any) => vs.userId !== UserStore.getCurrentUser().id
                    );

                    if (othersInCall.length === 0) {
                        DataStore.set(DATASTORE_SESSION_KEY, false);
                        return;
                    }
                }
                FluxDispatcher.dispatch({
                    type: "VOICE_CHANNEL_SELECT",
                    guildId: saved.guildId,
                    channelId: saved.channelId,
                });

                DataStore.set(DATASTORE_SESSION_KEY, true);
            }, settings.store.rejoinDelay);
        },
    },
});
