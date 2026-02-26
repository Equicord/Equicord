/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export const settings = definePluginSettings({
    showChatButton: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Whether you want to display the chat button",
        restartNeeded: true,
    },
    showMuteButton: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Whether you want to display the mute button",
        restartNeeded: true,
    },
    showDeafenButton: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Whether you want to display the deafen button",
        restartNeeded: true,
    },
    muteSoundboard: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Toggles their soundboard upon clicking deafen button.",
    },
    disableVideo: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Toggles their video upon clicking deafen button.",
    },
    useServer: {
        type: OptionType.BOOLEAN,
        description: "Use server mute/deafen instead of local when you have permission.",
        default: false,
    },
    serverSelf: {
        type: OptionType.BOOLEAN,
        description: "Deafen / Mute yourself on the server when using mute/deafen.",
        default: false,
    },
    showButtonsSelf: {
        type: OptionType.SELECT,
        description: "Whether you want to display buttons for your own user. Same functionality as other button(s) except it'll open DMs panel and mute/deafen for yourself upon clicking button(s).",
        restartNeeded: true,
        options: [
            { label: "Display", value: "display", default: true },
            { label: "Hide", value: "hide" },
            { label: "Disable", value: "disable" },
        ],
    },
    whichNameToShow: {
        type: OptionType.SELECT,
        description: "Choose whether to show nickname or username in tooltip.",
        options: [
            { label: "Both", value: "both", default: true },
            { label: "Global Name", value: "global" },
            { label: "Username", value: "username" },
        ],
    },
    buttonPosition: {
        type: OptionType.SELECT,
        description: "Choose where to place voice buttons in the voice user row.",
        options: [
            { label: "Left", value: "left", default: true },
            { label: "Right", value: "right" },
        ],
    }
}, {
    useServer: {
        disabled() {
            return !this.store.showMuteButton && !this.store.showDeafenButton;
        },
    },
    serverSelf: {
        disabled() {
            return !this.store.useServer && !this.store.showMuteButton && !this.store.showDeafenButton;
        },
    }
});
