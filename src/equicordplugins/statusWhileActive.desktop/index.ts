/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { getUserSettingLazy } from "@api/UserSettings";
import { Devs, EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { FluxDispatcher, PresenceStore, UserStore, VoiceStateStore } from "@webpack/common";

let savedStatus = "";
const StatusSettings = getUserSettingLazy("status", "status");
const settings = definePluginSettings({
    trigger: {
        type: OptionType.SELECT,
        description: "When to change your status",
        options: [
            {
                label: "While playing a game",
                value: "game",
            },
            {
                label: "While in a voice channel",
                value: "vc",
            },
            {
                label: "While playing or in a voice channel",
                value: "either",
                default: true
            },
        ]
    },
    statusToSet: {
        type: OptionType.SELECT,
        description: "Status to set",
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

let isActive = false;

function updateStatus() {
    const userId = UserStore.getCurrentUser()?.id;
    if (!userId) return;

    const currentStatus = PresenceStore.getStatus(userId);
    const trigger = settings.store.trigger;
    const newStatusToSet = settings.store.statusToSet;

    const isPlaying = PresenceStore.getActivities(userId).some(a => a.type === 0);
    const isInVC = !!VoiceStateStore.getVoiceStateForUser(userId)?.channelId;

    let shouldBeActive = false;
    if (trigger === "game") {
        shouldBeActive = isPlaying;
    } else if (trigger === "vc") {
        shouldBeActive = isInVC;
    } else if (trigger === "either") {
        shouldBeActive = isPlaying || isInVC;
    }

    if (shouldBeActive !== isActive) {
        isActive = shouldBeActive;

        if (isActive) {
            if (currentStatus !== newStatusToSet) {
                savedStatus = currentStatus;
            }
            StatusSettings?.updateSetting(newStatusToSet);
        } else {
            if (savedStatus && savedStatus !== newStatusToSet) {
                StatusSettings?.updateSetting(savedStatus);
            }
            savedStatus = "";
        }
    }
}

const debouncedUpdate = () => setTimeout(updateStatus, 250);

export default definePlugin({
    name: "StatusWhileActive",
    description: "Automatically updates your online status when playing games or in a voice channel.",
    authors: [Devs.thororen, EquicordDevs.smuki],
    settings,

    start() {
        FluxDispatcher.subscribe("RUNNING_GAMES_CHANGE", debouncedUpdate);
        FluxDispatcher.subscribe("VOICE_STATE_UPDATES", debouncedUpdate);
        debouncedUpdate();
    },

    stop() {
        FluxDispatcher.unsubscribe("RUNNING_GAMES_CHANGE", debouncedUpdate);
        FluxDispatcher.unsubscribe("VOICE_STATE_UPDATES", debouncedUpdate);

        if (savedStatus) {
            StatusSettings?.updateSetting(savedStatus);
            savedStatus = "";
        }
    }
});