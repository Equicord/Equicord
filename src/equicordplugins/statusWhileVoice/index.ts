/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { getUserSettingLazy } from "@api/UserSettings";
import { Devs, EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { PresenceStore, UserStore, VoiceStateStore } from "@webpack/common";

let savedStatus = "";
const StatusSettings = getUserSettingLazy("status", "status");
const settings = definePluginSettings({
    statusToSet: {
        type: OptionType.SELECT,
        description: "Status to set while in a voice channel",
        options: [
            {
                label: "Online",
                value: "online",
            },
            {
                label: "Idle",
                value: "idle",
            },
            {
                label: "Do Not Disturb",
                value: "dnd",
                default: true
            },
            {
                label: "Invisible",
                value: "invisible",
            }
        ]
    }
});

export default definePlugin({
    name: "StatusWhileInVC",
    description: "Automatically updates your online status when you join a voice channel",
    authors: [EquicordDevs.smuki],
    settings,
    flux: {
        VOICE_STATE_UPDATES({ voiceStates }) {
            const userId = UserStore.getCurrentUser().id;
            const currentUserVoiceState = voiceStates.find(vs => vs.userId === userId);

            if (currentUserVoiceState) {
                const status = PresenceStore.getStatus(userId);
                const inVoiceChannel = !!VoiceStateStore.getVoiceStateForUser(userId)?.channelId;

                if (inVoiceChannel) {
                    if (status !== settings.store.statusToSet) {
                        savedStatus = status;
                        StatusSettings?.updateSetting(settings.store.statusToSet);
                    }
                } else if (savedStatus && savedStatus !== settings.store.statusToSet) {
                    StatusSettings?.updateSetting(savedStatus);
                    savedStatus = "";
                }
            }
        }
    }
});