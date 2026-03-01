/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { t } from "@utils/translation";
import { OptionType } from "@utils/types";

export const settings = definePluginSettings({
    showChatButton: {
        type: OptionType.BOOLEAN,
        default: true,
        description: t("voiceButtons.settings.showChatButton"),
        restartNeeded: true,
    },
    showMuteButton: {
        type: OptionType.BOOLEAN,
        default: true,
        description: t("voiceButtons.settings.showMuteButton"),
        restartNeeded: true,
    },
    showDeafenButton: {
        type: OptionType.BOOLEAN,
        default: true,
        description: t("voiceButtons.settings.showDeafenButton"),
        restartNeeded: true,
    },
    muteSoundboard: {
        type: OptionType.BOOLEAN,
        default: true,
        description: t("voiceButtons.settings.muteSoundboard"),
    },
    disableVideo: {
        type: OptionType.BOOLEAN,
        default: true,
        description: t("voiceButtons.settings.disableVideo"),
    },
    useServer: {
        type: OptionType.BOOLEAN,
        description: t("voiceButtons.settings.useServer"),
        default: false,
    },
    serverSelf: {
        type: OptionType.BOOLEAN,
        description: t("voiceButtons.settings.serverSelf"),
        default: false,
    },
    showButtonsSelf: {
        type: OptionType.SELECT,
        description: t("voiceButtons.settings.showButtonsSelf"),
        restartNeeded: true,
        options: [
            { label: t("voiceButtons.options.display"), value: "display", default: true },
            { label: t("voiceButtons.options.hide"), value: "hide" },
            { label: t("voiceButtons.options.disable"), value: "disable" },
        ],
    },
    whichNameToShow: {
        type: OptionType.SELECT,
        description: t("voiceButtons.settings.whichNameToShow"),
        options: [
            { label: t("voiceButtons.options.both"), value: "both", default: true },
            { label: t("voiceButtons.options.globalName"), value: "global" },
            { label: t("voiceButtons.options.username"), value: "username" },
        ],
    },
    buttonPosition: {
        type: OptionType.SELECT,
        description: t("voiceButtons.settings.buttonPosition"),
        options: [
            { label: t("voiceButtons.options.left"), value: "left", default: true },
            { label: t("voiceButtons.options.right"), value: "right" },
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
