/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export type SoundboardSound = {
    soundId: string;
    name?: string;
    volume?: number;
    guildId?: string | null;
};

export type RoutedElementData = {
    mixerId: number;
    source: MediaElementAudioSourceNode;
    localGain?: GainNode;
    active: boolean;
    ownedElement: boolean;
    listeners: {
        playing: () => void;
        pause: () => void;
        ended: () => void;
        error: () => void;
    };
};

export type Mixer = {
    id: number;
    mixedStream: MediaStream;
    context: AudioContext;
    micSource: MediaStreamAudioSourceNode;
    micGain: GainNode;
    soundGain: GainNode;
    monoMerger: ChannelMergerNode;
    activeElements: Set<HTMLMediaElement>;
    activeSoundSources: number;
    closed: boolean;
    cleanup(): void;
};

export const state = {
    currentMixer: null as Mixer | null,
    pendingVoiceMixer: false,
    mixerForCurrentVoiceSession: false,
    mixerCounter: 0,
    replacingMixer: false,
    originalGetUserMedia: null as typeof navigator.mediaDevices.getUserMedia | null,
};

export const routedElements = new WeakMap<HTMLMediaElement, RoutedElementData>();
export const patchedTracks = new WeakSet<MediaStreamTrack>();

export const PLUGIN_NAME = "NitroSoundboardBypass";

export interface DiscordWindow extends Window {
    webkitAudioContext?: typeof AudioContext;
}
