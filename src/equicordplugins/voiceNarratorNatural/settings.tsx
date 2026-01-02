/*
 * VoiceNarratorNatural - TTS plugin with Windows Natural Voices support
 * Copyright (c) 2026 SrMoon (https://github.com/srmooon)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

import { SAPI5Section, SystemVoiceSection, TTSProviderSection } from "./VoiceSetting.tsx";

export function getCurrentVoice(voices = window.speechSynthesis?.getVoices()) {
    if (!voices) return undefined;
    if (settings.store.voice) {
        const voice = voices.find(v => v.voiceURI === settings.store.voice);
        if (voice) return voice;
    }
    const voice = voices.find(v => v.default);
    settings.store.voice = voice?.voiceURI;
    return voice;
}

export const settings = definePluginSettings({
    ttsProviderSelect: {
        type: OptionType.COMPONENT,
        description: "",
        component: TTSProviderSection
    },
    ttsProvider: {
        type: OptionType.STRING,
        description: "TTS Provider",
        default: "system",
        hidden: true
    },
    systemVoice: {
        type: OptionType.COMPONENT,
        description: "",
        component: SystemVoiceSection
    },
    sapi5Setup: {
        type: OptionType.COMPONENT,
        description: "",
        component: SAPI5Section
    },
    voice: {
        type: OptionType.STRING,
        description: "System Voice URI",
        default: "",
        hidden: true
    },
    sapi5Voice: {
        type: OptionType.STRING,
        description: "SAPI5 Voice ID",
        default: "",
        hidden: true
    },
    volume: {
        type: OptionType.SLIDER,
        description: "Volume",
        default: 1,
        markers: [0, 0.25, 0.5, 0.75, 1],
        stickToMarkers: false
    },
    rate: {
        type: OptionType.SLIDER,
        description: "Speed",
        default: 1,
        markers: [0.1, 0.5, 1, 2, 5, 10],
        stickToMarkers: false
    },
    sayOwnName: {
        type: OptionType.BOOLEAN,
        description: "Announce yourself (say your own name)",
        default: false
    },
    latinOnly: {
        type: OptionType.BOOLEAN,
        description: "Strip non-latin characters from names",
        default: false
    },
    joinMessage: {
        type: OptionType.STRING,
        description: "Join Message - Variables: {nickname}, {display_name}, {username}, {channel}, {server}",
        default: "{nickname} entered the voice"
    },
    leaveMessage: {
        type: OptionType.STRING,
        description: "Leave Message",
        default: "{nickname} left the voice"
    },
    moveMessage: {
        type: OptionType.STRING,
        description: "Move Message",
        default: "{nickname} moved to {channel}"
    },
    muteMessage: {
        type: OptionType.STRING,
        description: "Mute Message",
        default: "{nickname} muted"
    },
    unmuteMessage: {
        type: OptionType.STRING,
        description: "Unmute Message",
        default: "{nickname} unmuted"
    },
    deafenMessage: {
        type: OptionType.STRING,
        description: "Deafen Message",
        default: "{nickname} deafened"
    },
    undeafenMessage: {
        type: OptionType.STRING,
        description: "Undeafen Message",
        default: "{nickname} undeafened"
    }
});
