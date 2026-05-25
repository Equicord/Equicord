/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";
import { SelectedChannelStore } from "@webpack/common";

import { createMixer } from "./mixer";
import { PLUGIN_NAME, state } from "./state";

const logger = new Logger(PLUGIN_NAME);
const noop = () => {};

const PATCH_BRAND = Symbol.for("NitroSoundboardBypass.patched");
type Patched<T> = T & { [PATCH_BRAND]?: true };

function decideStreamWrapping(constraints?: MediaStreamConstraints): {
    shouldWrap: boolean;
    rollback: () => void;
} {
    if (!constraints) return { shouldWrap: false, rollback: noop };
    const hasAudio = constraints.audio === true || typeof constraints.audio === "object";
    if (!hasAudio) return { shouldWrap: false, rollback: noop };

    if (state.pendingVoiceMixer) {
        state.pendingVoiceMixer = false;
        const wasSessionActive = state.mixerForCurrentVoiceSession;
        state.mixerForCurrentVoiceSession = true;
        return {
            shouldWrap: true,
            rollback: () => {
                state.pendingVoiceMixer = true;
                state.mixerForCurrentVoiceSession = wasSessionActive;
            },
        };
    }

    if (state.mixerForCurrentVoiceSession) {
        return { shouldWrap: false, rollback: noop };
    }

    if (SelectedChannelStore.getVoiceChannelId()) {
        state.mixerForCurrentVoiceSession = true;
        return {
            shouldWrap: true,
            rollback: () => {
                state.mixerForCurrentVoiceSession = false;
            },
        };
    }

    return { shouldWrap: false, rollback: noop };
}

export function installGetUserMediaHook() {
    if (!navigator.mediaDevices.getUserMedia || state.originalGetUserMedia) return;

    state.originalGetUserMedia = navigator.mediaDevices.getUserMedia;
    const origGetUserMedia = state.originalGetUserMedia.bind(navigator.mediaDevices);

    const patched = async function (constraints?: MediaStreamConstraints) {
        const decision = decideStreamWrapping(constraints);

        let stream: MediaStream;
        try {
            stream = await origGetUserMedia(constraints);
        } catch (err) {
            decision.rollback();
            throw err;
        }

        if (!decision.shouldWrap) return stream;

        try {
            const mixer = createMixer(stream);
            if (!mixer) {
                decision.rollback();
                return stream;
            }
            return mixer.mixedStream;
        } catch (err) {
            logger.error("Failed to create mixed microphone stream", err);
            decision.rollback();
            return stream;
        }
    } as typeof navigator.mediaDevices.getUserMedia;

    (patched as Patched<typeof patched>)[PATCH_BRAND] = true;
    navigator.mediaDevices.getUserMedia = patched;
}

export function uninstallGetUserMediaHook() {
    if (!state.originalGetUserMedia) return;

    const current = navigator.mediaDevices.getUserMedia as Patched<typeof navigator.mediaDevices.getUserMedia>;
    if (current && (current as { [PATCH_BRAND]?: true })[PATCH_BRAND]) {
        navigator.mediaDevices.getUserMedia = state.originalGetUserMedia;
    } else {
        logger.warn("Another patch has wrapped navigator.mediaDevices.getUserMedia after us. Leaving the chain intact and dropping our reference.");
    }
    state.originalGetUserMedia = null;
}
