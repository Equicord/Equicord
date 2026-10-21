/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { PluginNative } from "@utils/types";

const Native = VencordNative.pluginHelpers.VoiceMessageTranscriber as PluginNative<typeof import("../native")>;

export async function fetchVoiceMessage(src: string): Promise<Blob> {
    if (IS_DISCORD_DESKTOP || IS_EQUIBOP) {
        const data = await Native.fetchAudio(src);
        return new Blob([new Uint8Array(data)]);
    }

    const res = await fetch(src);
    if (!res.ok) throw new Error("Failed to download audio");
    return res.blob();
}

const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext; }).webkitAudioContext;
const getAudioContext = () => {
    if (!AudioContextClass) throw new Error("AudioContext is not supported in this environment");
    return new AudioContextClass({ sampleRate: 16000 });
};
export async function decodeAudio(blob: Blob): Promise<Float32Array> {
    const arrayBuffer = await blob.arrayBuffer();
    const audioContext = getAudioContext();
    let audioBuffer: AudioBuffer;
    try {
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    } finally {
        audioContext.close().catch(() => { });
    }

    // Mix down to mono
    const channelData = audioBuffer.getChannelData(0);
    if (audioBuffer.numberOfChannels > 1) {
        for (let i = 1; i < audioBuffer.numberOfChannels; i++) {
            const channel = audioBuffer.getChannelData(i);
            for (let j = 0; j < channelData.length; j++) {
                channelData[j] += channel[j];
            }
        }
        for (let i = 0; i < channelData.length; i++) {
            channelData[i] /= audioBuffer.numberOfChannels;
        }
    }

    return channelData;
}
