/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DataStore } from "@api/index";
import { isPluginEnabled } from "@api/PluginManager";
import { definePluginSettings } from "@api/Settings";
import { Button } from "@components/Button";
import showMeYourName from "@plugins/showMeYourName";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { SoundboardSound, VoiceState } from "@vencord/discord-types";
import { ChannelStore, FluxDispatcher, GuildMemberStore, RelationshipStore, showToast, SoundboardStore, StreamerModeStore, UserStore, VoiceStateStore } from "@webpack/common";

interface SoundboardSoundPayload {
    sound_id: string;
    name: string;
    volume: number;
    emoji_id: string | null;
    emoji_name: string | null;
    guild_id: string | null;
    available: boolean;
}

const openConfig = () => {
    if (ws?.readyState !== WebSocket.OPEN) {
        showToast({ text: "Not connected to Orbolay", variant: "critical" });
        return;
    }

    ws.send(JSON.stringify({ cmd: "OPEN_CONFIG" }));
};

const settings = definePluginSettings({
    port: {
        type: OptionType.NUMBER,
        description: "Port to connect to",
        default: 6888,
        restartNeeded: true
    },
    openConfig: {
        type: OptionType.COMPONENT,
        component: () => <Button onClick={openConfig}>Open Orbolay settings</Button>
    },
});

const sendConfig = () => {
    if (ws?.readyState !== WebSocket.OPEN) return;

    const userId = UserStore.getCurrentUser()?.id;
    if (!userId) return;

    ws.send(JSON.stringify({ cmd: "REGISTER_CONFIG", userId }));
};

let ws: WebSocket | null = null;
let currentChannel: string | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let stopped = false;

const waitForPopulate = async fn => {
    while (true) {
        const result = await fn();
        if (result) return result;
        await new Promise(r => setTimeout(r, 500));
    }
};

const smynInVoice = () => isPluginEnabled(showMeYourName.name) && showMeYourName.settings.store.voiceChannels;

const usernameFor = (guildId: string, userId: string) => {
    const showFriendName = !guildId
        || smynInVoice() && !showMeYourName.settings.store.friendNameOnlyInDirectMessages;

    return (showFriendName && RelationshipStore.getNickname(userId)) ||
        GuildMemberStore.getNick(guildId, userId) ||
        UserStore?.getUser(userId)?.globalName ||
        UserStore?.getUser(userId)?.username;
};

const customNameFor = async (guildId: string, userId: string) => {
    if (!guildId || !smynInVoice() || showMeYourName.settings.store.customNameOnlyInDirectMessages) return;

    return (await DataStore.get<Record<string, string>>("SMYNCustomNicknames"))?.[userId];
};

const waitForUserData = async (guildId: string, userId: string) => {
    const deadline = Date.now() + 3000;
    while (!usernameFor(guildId, userId) && Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 100));
    }
};

const stateToPayload = async (guildId: string, state: VoiceState) => {
    await waitForUserData(guildId, state.userId);

    return {
        userId: state.userId,
        username: await customNameFor(guildId, state.userId) || usernameFor(guildId, state.userId),
        avatarUrl: UserStore?.getUser(state.userId)?.avatar,
        channelId: state.channelId ?? null,
        deaf: state.deaf || state.selfDeaf,
        mute: state.mute || state.selfMute,
        streaming: state.selfStream,
        speaking: false,
    };
};

const toSoundboardPayload = (sound: SoundboardSound, fallbackGuild?: string): SoundboardSoundPayload | null => {
    const soundId = sound?.soundId;
    if (!soundId) return null;

    const guildId = sound?.guildId ?? fallbackGuild;

    return {
        sound_id: soundId,
        name: sound.name,
        volume: sound.volume,
        emoji_id: sound?.emojiId ?? null,
        emoji_name: sound?.emojiName ?? null,
        guild_id: !guildId || guildId === "0" ? null : guildId,
        available: sound.available,
    };
};

const getSoundboardSounds = (): SoundboardSoundPayload[] => {
    const sounds: SoundboardSoundPayload[] = [];

    for (const [guildKey, guildSounds] of SoundboardStore.getSounds() ?? []) {
        for (const sound of guildSounds ?? []) {
            const payload = toSoundboardPayload(sound, guildKey);
            if (payload) sounds.push(payload);
        }
    }

    return sounds;
};

const sendSoundboardUpdate = () => {
    if (ws?.readyState !== WebSocket.OPEN) return;

    const sounds = getSoundboardSounds();
    if (!sounds.length) return;

    ws.send(JSON.stringify({ cmd: "SOUNDBOARD_UPDATE", sounds }));
};

const incoming = payload => {
    switch (payload.cmd) {
        case "TOGGLE_MUTE":
            FluxDispatcher.dispatch({
                type: "AUDIO_TOGGLE_SELF_MUTE",
                syncRemote: true,
                playSoundEffect: true,
                context: "default"
            });
            break;
        case "TOGGLE_DEAF":
            FluxDispatcher.dispatch({
                type: "AUDIO_TOGGLE_SELF_DEAF",
                syncRemote: true,
                playSoundEffect: true,
                context: "default"
            });
            break;
        case "DISCONNECT":
            FluxDispatcher.dispatch({
                type: "VOICE_CHANNEL_SELECT",
                channelId: null
            });
            break;
        case "STOP_STREAM": {
            const userId = UserStore.getCurrentUser().id;
            const voiceState = VoiceStateStore.getVoiceStateForUser(userId);
            if (!voiceState?.channelId) return;
            const channel = ChannelStore.getChannel(voiceState.channelId);
            if (!channel) return;

            FluxDispatcher.dispatch({
                type: "STREAM_STOP",
                streamKey: `guild:${channel.guild_id}:${voiceState.channelId}:${userId}`,
                appContext: "APP"
            });

            break;
        }
        case "NAVIGATE": {
            if (!payload.guild_id || !payload.channel_id || !payload.message_id) break;

            const { guild_id, channel_id, message_id } = payload;
            FluxDispatcher.dispatch({
                type: "CHANNEL_SELECT",
                guildId: String(guild_id),
                channelId: String(channel_id),
                messageId: String(message_id),
            });

            break;
        }
    }
};

const handleSpeaking = dispatch => {
    ws?.send(
        JSON.stringify({
            cmd: "VOICE_STATE_UPDATE",
            state: {
                userId: dispatch.userId,
                speaking: dispatch.speakingFlags === 1,
            },
        })
    );
};

const handleMessageNotification = dispatch => {
    ws?.send(
        JSON.stringify({
            cmd: "MESSAGE_NOTIFICATION",
            message: {
                title: dispatch.title,
                body: dispatch.body,
                icon: dispatch.icon,
                guildId: dispatch.message.guild_id,
                channelId: dispatch.message.channel_id,
                messageId: dispatch.message.id,
            }
        })
    );
};

const handleVoiceStateUpdates = async dispatch => {
    const userId = UserStore.getCurrentUser()?.id;

    for (const state of dispatch.voiceStates) {
        const ourState = state.userId === userId;
        const { guildId } = state;

        if (ourState) {
            if (state.channelId && state.channelId !== currentChannel) {
                const voiceStates = await waitForPopulate(() =>
                    VoiceStateStore?.getVoiceStatesForChannel(state.channelId)
                );

                ws?.send(
                    JSON.stringify({
                        cmd: "CHANNEL_JOINED",
                        states:
                            await Promise.all(
                                Object.values(voiceStates).map(s => stateToPayload(guildId, s as VoiceState))
                            ),
                    })
                );

                currentChannel = state.channelId;

                sendSoundboardUpdate();

                break;
            } else if (!state.channelId) {
                ws?.send(
                    JSON.stringify({
                        cmd: "CHANNEL_LEFT",
                    })
                );

                currentChannel = null;

                break;
            }
        }

        if (
            !!currentChannel &&
            (state.channelId === currentChannel ||
                state.oldChannelId === currentChannel)
        ) {
            ws?.send(
                JSON.stringify({
                    cmd: "VOICE_STATE_UPDATE",
                    state: await stateToPayload(guildId, state as VoiceState),
                })
            );
        }
    }
};

const handleStreamerMode = dispatch => {
    ws?.send(
        JSON.stringify({
            cmd: "STREAMER_MODE",
            enabled: dispatch.value,
        })
    );
};

const createWebsocket = () => {
    console.log("Attempting to connect to Orbolay server");
    if (ws?.close) ws.close();

    ws = new WebSocket("ws://127.0.0.1:" + settings.store.port);
    ws.onerror = () => {
        ws?.close?.();
        ws = null;

        if (!stopped) {
            if (retryTimer) clearTimeout(retryTimer);
            retryTimer = setTimeout(createWebsocket, 5000);
        }
    };
    ws.onmessage = e => {
        incoming(JSON.parse(e.data));
    };
    ws.onclose = () => {
        ws = null;

        if (!stopped) {
            if (retryTimer) clearTimeout(retryTimer);
            retryTimer = setTimeout(createWebsocket, 5000);
        }
    };
    ws.onopen = async () => {
        showToast({ text: "Connected to Orbolay server", variant: "success" });

        const userId = await waitForPopulate(() => UserStore.getCurrentUser().id);
        if (!userId) return;

        sendConfig();

        // Let the client know whether we are in streamer mode
        ws?.send(
            JSON.stringify({
                cmd: "STREAMER_MODE",
                enabled: StreamerModeStore.enabled,
            })
        );

        const userVoiceState = VoiceStateStore.getVoiceStateForUser(userId);
        if (!userVoiceState || !userVoiceState.channelId) return;

        const channel = ChannelStore.getChannel(userVoiceState.channelId);
        if (!channel) return;

        const guildId = channel.guild_id;
        const channelState = VoiceStateStore.getVoiceStatesForChannel(userVoiceState.channelId);
        if (!guildId || !channelState) return;

        ws?.send(
            JSON.stringify({
                cmd: "CHANNEL_JOINED",
                states:
                    await Promise.all(
                        Object.values(channelState).map(s => stateToPayload(guildId, s as VoiceState))
                    ),
            })
        );

        currentChannel = userVoiceState.channelId;

        sendSoundboardUpdate();
    };
};

export default definePlugin({
    name: "OrbolayBridge",
    description: "Bridge plugin to connect Orbolay to Discord",
    tags: ["Utility", "Voice"],
    authors: [EquicordDevs.SpikeHD],
    settings,
    flux: {
        SPEAKING: handleSpeaking,
        VOICE_STATE_UPDATES: handleVoiceStateUpdates,
        RPC_NOTIFICATION_CREATE: handleMessageNotification,
        STREAMER_MODE: handleStreamerMode,
    },

    start() {
        stopped = false;
        if (retryTimer) clearTimeout(retryTimer);
        createWebsocket();
    },

    stop() {
        stopped = true;
        if (retryTimer) clearTimeout(retryTimer);
        ws?.close?.();
        ws = null;
    }
});
