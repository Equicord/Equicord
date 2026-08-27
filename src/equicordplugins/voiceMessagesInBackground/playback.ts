/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { type AudioPlayerInterface, createAudioPlayer } from "@api/AudioPlayer";
import { FluxDispatcher, SelectedChannelStore, useEffect, useRef } from "@webpack/common";
import type { Dispatch, SetStateAction } from "react";

type NativePlayingState = [boolean, Dispatch<SetStateAction<boolean>>];

interface ActivePlayback {
    attached: boolean;
    cacheKey?: string;
    channelId?: string;
    duration: number;
    paused: boolean;
    player: AudioPlayerInterface;
    position: number;
    setNativePlaying?: Dispatch<SetStateAction<boolean>>;
    setNativePosition?: Dispatch<SetStateAction<number>>;
    speed: number;
    src: string;
    updatedAt: number;
}

export interface PlaybackSnapshot {
    channelId?: string;
    duration: number;
    paused: boolean;
    position: number;
    speed: number;
    src: string;
}

let active: ActivePlayback | undefined;
let lastCacheSync = 0;
let voicePlaybackSpeed = 1;

const NATIVE_END_TOLERANCE = 0.05;

function playbackPosition(current: ActivePlayback) {
    if (current.paused) return current.position;

    const position = current.position + (Date.now() - current.updatedAt) / 1000 * current.speed;
    return current.duration > 0 ? Math.min(position, current.duration) : position;
}

function updatePosition(current: ActivePlayback, position: number) {
    current.position = Math.max(0, position);
    current.updatedAt = Date.now();
}

function syncPlaybackCache(current: ActivePlayback, force = false) {
    if (!current.cacheKey || current.duration <= 0) return;

    const now = Date.now();
    if (!force && now - lastCacheSync < 1000) return;
    lastCacheSync = now;
    FluxDispatcher.dispatch({
        type: "MEDIA_PLAYBACK_POSITION_UPDATE",
        cacheKey: current.cacheKey,
        position: playbackPosition(current),
        duration: current.duration
    });
}

export function stopPlayback() {
    const current = active;
    if (!current) return;

    active = undefined;
    current.setNativePlaying?.(false);
    current.setNativePosition?.(0);
    current.player.delete();
    if (current.cacheKey) {
        FluxDispatcher.dispatch({
            type: "MEDIA_PLAYBACK_POSITION_UPDATE",
            cacheKey: current.cacheKey,
            position: 0,
            duration: Math.max(current.duration, 1)
        });
    }
}

function createBackgroundPlayback(src: string, cacheKey: string | undefined, position: number) {
    stopPlayback();

    const player = createAudioPlayer(src, {
        persistent: true,
        preload: true,
        speed: voicePlaybackSpeed,
        onEnded: () => {
            if (active?.player === player) stopPlayback();
        },
        onError: () => {
            if (active?.player === player) stopPlayback();
        }
    });
    const current: ActivePlayback = active = {
        attached: true,
        cacheKey,
        channelId: SelectedChannelStore.getChannelId(),
        duration: 0,
        paused: false,
        player,
        position,
        speed: voicePlaybackSpeed,
        src,
        updatedAt: Date.now()
    };
    player.mute();
    player.seek(position);

    const { duration } = player;
    if (duration) {
        void duration.then(value => {
            if (active !== current || !Number.isFinite(value)) return;

            current.duration = value;
            if (current.paused && value > 0 && current.position >= value - NATIVE_END_TOLERANCE) stopPlayback();
        }).catch(() => {
            if (active === current) stopPlayback();
        });
    }

    lastCacheSync = 0;
    return current;
}

function playFromNative(
    src: string,
    cacheKey: string | undefined,
    position: number,
    setNativePlaying: Dispatch<SetStateAction<boolean>>,
    setNativePosition: Dispatch<SetStateAction<number>>
) {
    const current = active?.src === src
        ? active
        : createBackgroundPlayback(src, cacheKey, position);

    current.attached = true;
    current.cacheKey = cacheKey;
    current.paused = false;
    current.setNativePlaying = setNativePlaying;
    current.setNativePosition = setNativePosition;
    updatePosition(current, position);
    current.player.mute();
    current.player.pause();
    syncPlaybackCache(current, true);
}

function pauseFromNative(src: string, position: number) {
    const current = active;
    if (!current || current.src !== src || !current.attached) return;

    const latestPosition = Math.max(position, playbackPosition(current));
    if (current.duration > 0 && latestPosition >= current.duration - NATIVE_END_TOLERANCE) {
        stopPlayback();
        return;
    }

    updatePosition(current, latestPosition);
    current.paused = true;
    current.player.pause();
    syncPlaybackCache(current, true);
}

export function useBackgroundPlayback(
    nativeState: NativePlayingState,
    nativePosition: number,
    src: string,
    cacheKey: string | undefined,
    setNativePosition: Dispatch<SetStateAction<number>>
) {
    const [nativePlaying, setNativePlaying] = nativeState;
    const nativePlayingRef = useRef(nativePlaying);
    const nativePositionRef = useRef(nativePosition);
    nativePlayingRef.current = nativePlaying;
    nativePositionRef.current = nativePosition;

    useEffect(() => {
        const current = active;
        if (current?.src === src && !current.attached) {
            const position = playbackPosition(current);
            const playing = !current.paused;
            updatePosition(current, position);
            current.attached = true;
            current.setNativePlaying = setNativePlaying;
            current.setNativePosition = setNativePosition;
            current.player.mute();
            current.player.pause();
            current.player.seek(position);
            nativePlayingRef.current = playing;
            nativePositionRef.current = position;
            setNativePosition(position);
            setNativePlaying(playing);
            syncPlaybackCache(current, true);
        }

        return () => {
            const current = active;
            if (!current || current.src !== src || current.setNativePlaying !== setNativePlaying) return;

            updatePosition(current, nativePositionRef.current);
            current.attached = false;
            current.paused = !nativePlayingRef.current;
            current.setNativePlaying = undefined;
            current.setNativePosition = undefined;
            current.player.seek(current.position);
            current.player.unmute();
            current.paused ? current.player.pause() : current.player.play();
            syncPlaybackCache(current, true);
        };
    }, [setNativePlaying, setNativePosition, src]);

    useEffect(() => {
        nativePlayingRef.current
            ? playFromNative(src, cacheKey, nativePositionRef.current, setNativePlaying, setNativePosition)
            : pauseFromNative(src, nativePositionRef.current);
    }, [cacheKey, nativePlaying, setNativePlaying, setNativePosition, src]);

    useEffect(() => {
        const current = active;
        if (!current || current.src !== src || current.setNativePosition !== setNativePosition) return;

        updatePosition(current, nativePositionRef.current);
        syncPlaybackCache(current);
    }, [nativePosition, setNativePosition, src]);

    return nativeState;
}

export function getPlaybackSnapshot(): PlaybackSnapshot | undefined {
    const current = active;
    if (!current) return;

    const position = playbackPosition(current);
    syncPlaybackCache(current);
    return {
        channelId: current.channelId,
        duration: current.duration,
        paused: current.paused,
        position,
        speed: current.speed,
        src: current.src
    };
}

export function togglePlayback() {
    const current = active;
    if (!current) return;

    if (current.attached && current.setNativePlaying) {
        current.setNativePlaying(current.paused);
        return;
    }

    updatePosition(current, playbackPosition(current));
    current.paused = !current.paused;
    current.paused ? current.player.pause() : current.player.play();
    syncPlaybackCache(current, true);
}

export function seekPlayback(position: number) {
    const current = active;
    if (!current) return;

    const target = Math.max(0, Math.min(position, current.duration || position));
    updatePosition(current, target);
    current.player.seek(target);
    current.setNativePosition?.(target);
    syncPlaybackCache(current, true);
}

export function setPlaybackSpeed(speed: number) {
    const current = active;
    if (!current) return;

    updatePosition(current, playbackPosition(current));
    current.speed = speed;
    current.player.speed = speed;
    FluxDispatcher.dispatch({
        type: "MEDIA_PLAYBACK_RATE_UPDATE",
        playbackType: "voice_message",
        rate: speed
    });
}

export function handlePlaybackRateUpdate(speed: number) {
    voicePlaybackSpeed = speed;
    const current = active;
    if (!current || current.speed === speed) return;

    updatePosition(current, playbackPosition(current));
    current.speed = speed;
    current.player.speed = speed;
}
