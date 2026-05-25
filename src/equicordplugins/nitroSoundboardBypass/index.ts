/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EquicordDevs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin from "@utils/types";

import { installGetUserMediaHook, uninstallGetUserMediaHook } from "./hooks";
import { playSoundViaAudioElement, shouldHookSound } from "./routing";
import { settings } from "./settings";
import { PLUGIN_NAME, state } from "./state";

const logger = new Logger(PLUGIN_NAME);

function normalizeSoundPayload(raw: unknown): { soundId: string; name?: string; volume?: number; guildId?: string | null } | null {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const r = raw as Record<string, unknown>;

    const inner = r.sound;
    if (typeof inner === "object" && inner !== null && !Array.isArray(inner)) {
        const merged: Record<string, unknown> = { ...(inner as Record<string, unknown>) };
        if (typeof r.guildId === "string" && typeof merged.guildId !== "string") merged.guildId = r.guildId;
        if (typeof r.guild_id === "string" && typeof merged.guild_id !== "string") merged.guild_id = r.guild_id;
        return normalizeSoundPayload(merged);
    }

    const getStr = (key: string) => {
        const v = r[key];
        return typeof v === "string" ? v : undefined;
    };

    const soundId = getStr("soundId") ?? getStr("sound_id");
    if (!soundId) return null;

    return {
        soundId,
        name: getStr("name") ?? soundId,
        volume: typeof r.volume === "number" ? r.volume : 1,
        guildId: getStr("guildId") ?? getStr("guild_id") ?? getStr("sourceGuildId") ?? getStr("source_guild_id") ?? null,
    };
}

export default definePlugin({
    name: PLUGIN_NAME,
    description: "Unlocks the soundboard UI for non-Nitro users and routes locked sound clicks through your microphone so other voice participants can hear them.",
    tags: ["Voice"],
    authors: [EquicordDevs.GlebTiK],

    settings,

    patches: [
        {
            find: "canUseSoundboardEverywhere",
            replacement: {
                match: /canUseSoundboardEverywhere(?::function)?\((?:\i)?\)\{/,
                replace: "$&if($self.shouldUnlockSoundboard())return!0;",
            },
        },
        {
            find: ".SEND_SOUNDBOARD_SOUND(",
            replacement: {
                match: /function \i\(\i,\i,\i,\i\)\{(?=\(0,\i\.\i\)\(\i,\i,\i\.\i\.SOUNDBOARD\))/,
                replace: "$&if($self.handleSoundboardSend(arguments[0]))return;",
            },
        },
    ],

    flux: {
        VOICE_CHANNEL_SELECT(e: { channelId?: string | null }) {
            if (e.channelId == null) {
                state.pendingVoiceMixer = false;
                state.mixerForCurrentVoiceSession = false;
            } else {
                state.pendingVoiceMixer = true;
                state.mixerForCurrentVoiceSession = false;
            }
        },
        GUILD_SOUNDBOARD_SOUND_PLAY_LOCALLY(e: unknown) {
            if (!settings.store.hookPreview) return;
            const sound = normalizeSoundPayload(e);
            if (!sound || !shouldHookSound(sound)) return;
            void playSoundViaAudioElement(sound, { localPlayback: false });
        },
    },

    shouldUnlockSoundboard(): boolean {
        return true;
    },

    handleSoundboardSend(sound: unknown): boolean {
        const normalized = normalizeSoundPayload(sound);
        if (!normalized || !shouldHookSound(normalized)) return false;
        void playSoundViaAudioElement(normalized);
        return true;
    },

    start() {
        installGetUserMediaHook();
        logger.info("Plugin started");
    },

    stop() {
        state.currentMixer?.cleanup();
        uninstallGetUserMediaHook();
        state.pendingVoiceMixer = false;
        state.mixerForCurrentVoiceSession = false;
        logger.info("Plugin stopped");
    },
});
