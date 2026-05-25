/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";
import { findByPropsLazy } from "@webpack";
import {
    ChannelStore,
    lodash,
    OverridePremiumTypeStore,
    SelectedChannelStore,
    SelectedGuildStore,
    showToast,
    SoundboardStore,
    Toasts,
} from "@webpack/common";

import { syncMixerGains } from "./mixer";
import { settings } from "./settings";
import { PLUGIN_NAME, routedElements, type SoundboardSound,state } from "./state";

const logger = new Logger(PLUGIN_NAME);

type SoundboardStoreLike = {
    getSound?(guildId: string, soundId: string): SoundboardSound | undefined;
    getSoundById?(soundId: string): SoundboardSound | undefined;
};

type SoundboardSoundURLModule = {
    getSoundboardSoundURL(soundId: string): string;
};

const SoundboardSoundURLs: SoundboardSoundURLModule = findByPropsLazy("getSoundboardSoundURL");

export function cleanupRoutedElement(
    element: HTMLMediaElement,
    options: { clearSource?: boolean; updateMixerState?: boolean } = {},
) {
    const data = routedElements.get(element);
    if (!data) return;

    if (options.updateMixerState !== false) {
        const mixer = state.currentMixer;
        if (mixer && mixer.id === data.mixerId && !mixer.closed) {
            if (data.active) {
                mixer.activeSoundSources = Math.max(0, mixer.activeSoundSources - 1);
                data.active = false;
                syncMixerGains(mixer);
            }
            mixer.activeElements.delete(element);
        }
    }

    element.removeEventListener("playing", data.listeners.playing);
    element.removeEventListener("pause", data.listeners.pause);
    element.removeEventListener("ended", data.listeners.ended);
    element.removeEventListener("error", data.listeners.error);
    data.source.disconnect();
    data.localGain?.disconnect();
    routedElements.delete(element);

    if (options.clearSource) {
        element.pause();
        element.removeAttribute("src");
        element.load();
    }
}

function setRoutedElementActive(element: HTMLMediaElement, active: boolean) {
    const data = routedElements.get(element);
    if (!data || data.active === active) return;

    const mixer = state.currentMixer;
    if (!mixer || mixer.id !== data.mixerId || mixer.closed) {
        data.active = false;
        return;
    }

    data.active = active;
    mixer.activeSoundSources = active
        ? mixer.activeSoundSources + 1
        : Math.max(0, mixer.activeSoundSources - 1);

    syncMixerGains(mixer);
}

function releaseRoutedElement(element: HTMLMediaElement) {
    const data = routedElements.get(element);
    if (!data) return;
    cleanupRoutedElement(element, { clearSource: data.ownedElement });
}

function getSoundById(soundId: string, guildId?: string | null): SoundboardSound {
    const store = SoundboardStore as SoundboardStoreLike;
    if (guildId) {
        const sound = store.getSound?.(guildId, soundId);
        if (sound) return sound;
    }
    return store.getSoundById?.(soundId)
        ?? { soundId, guildId: guildId ?? null, name: soundId, volume: 1 };
}

export function shouldHookSound(sound: SoundboardSound | null | undefined): boolean {
    if (!sound?.soundId) return false;
    if (settings.store.hookAllSoundboardSounds) return true;

    const premiumType = OverridePremiumTypeStore.getState().premiumTypeActual;
    if (typeof premiumType === "number" && premiumType > 0) return false;

    if (!sound.guildId || sound.guildId === "0") return false;

    const voiceChannelId = SelectedChannelStore.getVoiceChannelId();
    const voiceGuildId = voiceChannelId ? ChannelStore.getChannel(voiceChannelId)?.guild_id ?? null : null;
    const referenceGuildId = voiceGuildId ?? SelectedGuildStore.getGuildId() ?? null;

    return Boolean(referenceGuildId && sound.guildId !== referenceGuildId);
}

function routeToMixer(
    element: HTMLMediaElement,
    options: { ownedElement: boolean; localPlayback: boolean },
): boolean {
    const mixer = state.currentMixer;
    if (!mixer || mixer.closed) return false;
    if (routedElements.has(element)) return true;

    syncMixerGains(mixer);

    if (mixer.context.state === "suspended") {
        mixer.context.resume().catch(err => logger.warn("AudioContext.resume() failed", err));
    }
    if (!element.crossOrigin) element.crossOrigin = "anonymous";

    let source: MediaElementAudioSourceNode;
    let localGain: GainNode | undefined;

    try {
        source = mixer.context.createMediaElementSource(element);
        source.connect(mixer.soundGain);

        if (options.localPlayback) {
            localGain = mixer.context.createGain();
            source.connect(localGain);
            localGain.connect(mixer.context.destination);
        }
    } catch (err) {
        logger.warn("Could not route soundboard audio element into mic", err);
        return false;
    }

    const listeners = {
        playing: () => setRoutedElementActive(element, true),
        pause: () => setRoutedElementActive(element, false),
        ended: () => releaseRoutedElement(element),
        error: () => releaseRoutedElement(element),
    };

    routedElements.set(element, {
        mixerId: mixer.id,
        source,
        localGain,
        active: false,
        ownedElement: options.ownedElement,
        listeners,
    });

    element.addEventListener("playing", listeners.playing);
    element.addEventListener("pause", listeners.pause);
    element.addEventListener("ended", listeners.ended);
    element.addEventListener("error", listeners.error);

    mixer.activeElements.add(element);

    return true;
}

export async function playSoundViaAudioElement(
    sound: SoundboardSound,
    options: { localPlayback?: boolean } = {},
) {
    const mixer = state.currentMixer;
    if (!mixer || mixer.closed) {
        logger.warn(`Cannot play "${sound.name ?? sound.soundId}". Mic mixer inactive (not in voice).`);
        showToast("Mic mixer inactive. Join or rejoin voice after enabling the plugin.", Toasts.Type.FAILURE);
        return;
    }

    syncMixerGains(mixer);

    if (mixer.context.state === "suspended") {
        try {
            await mixer.context.resume();
        } catch (err) {
            logger.warn("AudioContext.resume() failed before forced play", err);
        }
    }

    let urlString: string;
    try {
        urlString = SoundboardSoundURLs.getSoundboardSoundURL(sound.soundId);
    } catch (err) {
        logger.error("getSoundboardSoundURL unavailable", err);
        showToast(`Could not resolve URL for "${sound.name ?? sound.soundId}".`, Toasts.Type.FAILURE);
        return;
    }

    const rawVolume = sound.volume;
    const initialVolume = typeof rawVolume === "number" && Number.isFinite(rawVolume)
        ? lodash.clamp(rawVolume > 1 ? rawVolume / 100 : rawVolume, 0, 1)
        : 1;

    const audio = new Audio();
    audio.crossOrigin = "anonymous";
    audio.preload = "auto";
    audio.volume = initialVolume;
    audio.src = urlString;

    const localPlayback = options.localPlayback ?? settings.store.keepLocalPlayback;

    if (!routeToMixer(audio, { ownedElement: true, localPlayback })) {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
        showToast(`Could not route "${sound.name ?? sound.soundId}" into the mic mixer.`, Toasts.Type.FAILURE);
        return;
    }

    try {
        await audio.play();
    } catch (err) {
        releaseRoutedElement(audio);
        logger.error("Soundboard audio failed", err);
        showToast(`Could not play "${sound.name ?? sound.soundId}".`, Toasts.Type.FAILURE);
    }
}
