/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";
import { lodash } from "@webpack/common";

import { cleanupRoutedElement } from "./routing";
import { settings } from "./settings";
import { type DiscordWindow, type Mixer,patchedTracks, PLUGIN_NAME, state } from "./state";

const logger = new Logger(PLUGIN_NAME);

export function syncMixerGains(mixer = state.currentMixer) {
    if (!mixer || mixer.closed) return;
    const { micVolume, soundVolume } = settings.store;
    mixer.micGain.gain.value = mixer.activeSoundSources > 0 ? lodash.clamp(micVolume / 100, 0, 1) : 1;
    mixer.soundGain.gain.value = lodash.clamp(soundVolume / 100, 0, 1);
}

export function createMixer(stream: MediaStream): Mixer | null {
    if (!stream.getAudioTracks().length) return null;

    const AudioContextCtor = window.AudioContext ?? (window as DiscordWindow).webkitAudioContext;
    if (!AudioContextCtor) {
        logger.error("AudioContext is not available in this environment");
        return null;
    }

    let context: AudioContext;
    try {
        context = new AudioContextCtor();
    } catch (err) {
        logger.error("Failed to construct AudioContext", err);
        return null;
    }

    let destination: MediaStreamAudioDestinationNode;
    let micSource: MediaStreamAudioSourceNode;
    let micGain: GainNode;
    let soundGain: GainNode;
    let monoMerger: ChannelMergerNode;
    let mixedStream: MediaStream;

    try {
        destination = context.createMediaStreamDestination();
        micSource = context.createMediaStreamSource(stream);
        micGain = context.createGain();
        soundGain = context.createGain();
        monoMerger = context.createChannelMerger(1);

        micSource.connect(micGain);
        micGain.connect(monoMerger, 0, 0);
        soundGain.connect(monoMerger, 0, 0);
        monoMerger.connect(destination);

        mixedStream = new MediaStream([
            ...destination.stream.getAudioTracks(),
            ...stream.getVideoTracks(),
        ]);
    } catch (err) {
        logger.error("Failed to wire mixer nodes", err);
        context.close().catch(err => logger.debug("AudioContext.close() failed", err));
        return null;
    }

    const trackListenerAbort = new AbortController();

    const mixer: Mixer = {
        id: ++state.mixerCounter,
        mixedStream,
        context,
        micSource,
        micGain,
        soundGain,
        monoMerger,
        activeElements: new Set<HTMLMediaElement>(),
        activeSoundSources: 0,
        closed: false,

        cleanup() {
            if (this.closed) return;
            this.closed = true;

            trackListenerAbort.abort();

            for (const element of Array.from(this.activeElements)) {
                cleanupRoutedElement(element, { clearSource: true, updateMixerState: false });
            }
            this.activeElements.clear();
            this.activeSoundSources = 0;

            this.micSource.disconnect();
            this.micGain.disconnect();
            this.soundGain.disconnect();
            this.monoMerger.disconnect();
            this.context.close().catch(err => logger.debug("AudioContext.close() failed", err));

            if (state.currentMixer === this) {
                state.currentMixer = null;
                if (!state.replacingMixer) state.mixerForCurrentVoiceSession = false;
            }
        },
    };

    syncMixerGains(mixer);

    let mixerCleanupStarted = false;
    const cleanupMixer = () => {
        if (mixerCleanupStarted) return;
        mixerCleanupStarted = true;
        mixer.cleanup();
    };

    for (const originalTrack of stream.getAudioTracks()) {
        originalTrack.addEventListener("ended", cleanupMixer, {
            once: true,
            signal: trackListenerAbort.signal,
        });
    }

    for (const mixedTrack of mixedStream.getAudioTracks()) {
        if (patchedTracks.has(mixedTrack)) continue;
        patchedTracks.add(mixedTrack);

        const originalStop = mixedTrack.stop.bind(mixedTrack);
        let stopped = false;

        mixedTrack.stop = () => {
            if (!stopped) {
                stopped = true;
                for (const originalTrack of stream.getTracks()) originalTrack.stop();
                cleanupMixer();
            }
            originalStop();
        };
    }

    state.replacingMixer = true;
    try {
        state.currentMixer?.cleanup();
    } finally {
        state.replacingMixer = false;
    }
    state.currentMixer = mixer;

    return mixer;
}
