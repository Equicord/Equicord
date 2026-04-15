/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export const settings = definePluginSettings({
    notifyEnabled: {
        type: OptionType.BOOLEAN,
        description: "Enables/Disables the plugin audio notifications.",
        default: true
    },
    notifyWhenDeafen: {
        type: OptionType.BOOLEAN,
        description: "Notify when you are self deafen.",
        default: true
    },
    notifyServerMuted: {
        type: OptionType.BOOLEAN,
        description: "Notify when you get muted by server.",
        default: false
    },
    audioUrl: {
        type: OptionType.STRING,
        description: "Custom Audio URL. URL to the audio file to play when user tries to speak while muted.",
        default: "defaultAudioUrl"
    },
    audioVolume: {
        type: OptionType.SLIDER,
        description: "Audio Volume. Sets audio volume.",
        markers: [0, 20, 40, 60, 80, 100],
        default: 100,
        componentProps: {
            stickToMarkers: false,
            onValueRender: null, // Defaults to percentage
        },
    },
    delayBetweenNotifications: {
        type: OptionType.NUMBER,
        description: "Delay Between Audio Notifications (ms). Delay Between Audio Notifications in milliseconds.",
        min: 0,
        step: 100,
        default: 5000
    },
    showToggleButton: {
        type: OptionType.BOOLEAN,
        description: "Show Toggle Button. Displays a button nearby krisp in the RTC panel to toggle On/Off the audio notifications.",
        default: true
    }
});
