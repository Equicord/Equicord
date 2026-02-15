/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Logger } from "@utils/Logger";
import { t } from "@utils/translation";
import { OptionType } from "@utils/types";

import { VoiceSettingSection } from "./VoiceSetting";

export const getDefaultVoice = () => window.speechSynthesis?.getVoices().find(v => v.default);

export function getCurrentVoice(voices = window.speechSynthesis?.getVoices()) {
    if (!voices) return undefined;

    if (settings.store.voice) {
        const voice = voices.find(v => v.voiceURI === settings.store.voice);
        if (voice) return voice;

        new Logger("VcNarrator").error(`Voice "${settings.store.voice}" not found. Resetting to default.`);
    }

    const voice = voices.find(v => v.default);
    settings.store.voice = voice?.voiceURI;
    return voice;
}

export const settings = definePluginSettings({
    voice: {
        type: OptionType.COMPONENT,
        component: VoiceSettingSection,
        get default() {
            return getDefaultVoice()?.voiceURI;
        }
    },
    volume: {
        type: OptionType.SLIDER,
        description: t("vcNarrator.settings.volume"),
        default: 1,
        markers: [0, 0.25, 0.5, 0.75, 1],
        stickToMarkers: false
    },
    rate: {
        type: OptionType.SLIDER,
        description: t("vcNarrator.settings.speed"),
        default: 1,
        markers: [0.1, 0.5, 1, 2, 5, 10],
        stickToMarkers: false
    },
    sayOwnName: {
        description: t("vcNarrator.settings.sayOwnName"),
        type: OptionType.BOOLEAN,
        default: false
    },
    latinOnly: {
        description: t("vcNarrator.settings.latinOnly"),
        type: OptionType.BOOLEAN,
        default: false
    },
    joinMessage: {
        type: OptionType.STRING,
        description: t("vcNarrator.settings.joinMessage"),
        default: t("vcNarrator.defaults.join")
    },
    leaveMessage: {
        type: OptionType.STRING,
        description: t("vcNarrator.settings.leaveMessage"),
        default: t("vcNarrator.defaults.leave")
    },
    moveMessage: {
        type: OptionType.STRING,
        description: t("vcNarrator.settings.moveMessage"),
        default: t("vcNarrator.defaults.move")
    },
    muteMessage: {
        type: OptionType.STRING,
        description: t("vcNarrator.settings.muteMessage"),
        default: t("vcNarrator.defaults.mute")
    },
    unmuteMessage: {
        type: OptionType.STRING,
        description: t("vcNarrator.settings.unmuteMessage"),
        default: t("vcNarrator.defaults.unmute")
    },
    deafenMessage: {
        type: OptionType.STRING,
        description: t("vcNarrator.settings.deafenMessage"),
        default: t("vcNarrator.defaults.deafen")
    },
    undeafenMessage: {
        type: OptionType.STRING,
        description: t("vcNarrator.settings.undeafenMessage"),
        default: t("vcNarrator.defaults.undeafen")
    }
});
