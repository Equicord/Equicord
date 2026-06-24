/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { ChannelStore, FluxDispatcher, GuildMemberStore, StreamerModeStore, Toasts, UserStore, VoiceStateStore } from "@webpack/common";

interface ChannelState {
    userId: string;
    channelId: string;
    deaf: boolean;
    mute: boolean;
    stream: boolean;
    selfDeaf: boolean;
    selfMute: boolean;
    selfStream: boolean;
}

const settings = definePluginSettings({
    port: {
        type: OptionType.NUMBER,
        description: "Port to connect to",
        default: 6888,
        restartNeeded: true
    },
    autoReconnect: {
        type: OptionType.BOOLEAN,
        description: "Auto-reconnect to Orbolay server when connection is lost",
        default: true,
        restartNeeded: false
    },
    maxReconnectDelay: {
        type: OptionType.SLIDER,
        description: "Maximum reconnect delay (in seconds)",
        markers: [5, 10, 15, 30, 45, 60, 90, 120, 180, 240, 300],
        stickToMarkers: false,
        default: 60,
        restartNeeded: false
    },
    minReconnectDelay: {
        type: OptionType.SLIDER,
        description: "Minimum reconnect delay (in seconds)",
        markers: [1, 2, 5, 10, 15, 20, 25, 30],
        stickToMarkers: false,
        default: 1,
        restartNeeded: false
    },
    reconnectMultiplier: {
        type: OptionType.SLIDER,
        description: "Reconnect backoff multiplier",
        markers: [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5],
        stickToMarkers: false,
        default: 2,
        restartNeeded: false
    },
    sendConnectedNotification: {
        type: OptionType.BOOLEAN,
        description: "Send a connected notification to Orbolay when connected successfully",
        default: true,
        restartNeeded: false
    },
    showToasts: {
        type: OptionType.BOOLEAN,
        description: "Show toast notifications for connection events",
        default: true,
        restartNeeded: false
    },
    sendTest: {
        type: OptionType.COMPONENT,
        component: () => (
            <Button onClick={() => {
                if (ws?.readyState !== WebSocket.OPEN) {
                    showToast({
                        message: "Cannot send test notification: Not connected to Orbolay server",
                        type: Toasts.Type.FAILURE,
                        id: Toasts.genId()
                    });
                    return;
                }

                ws.send(
                    JSON.stringify({
                        cmd: "MESSAGE_NOTIFICATION",
                        message: {
                            title: "Orbolay Test",
                            body: "This is a test notification from the Equicord OrbolayBridgeFork plugin!",
                            icon: "https://raw.githubusercontent.com/Equicord/Equicord/refs/heads/main/browser/icon.png",
                            guildId: "0",
                            channelId: "0",
                            messageId: "0",
                        }
                    })
                );

                showToast({
                    message: "Test notification sent to Orbolay",
                    type: Toasts.Type.SUCCESS,
                    id: Toasts.genId()
                });
            }}>
                Send Test Notification
            </Button>
        )
    }
});

const showToast = (toast: Parameters<typeof Toasts.show>[0]) => {
    if (settings.store.showToasts) {
        Toasts.show(toast);
    }
};

const sendConfig = () => {
    if (ws?.readyState !== WebSocket.OPEN) return;

    const userId = UserStore.getCurrentUser()?.id;
    if (!userId) return;

    ws.send(JSON.stringify({ cmd: "REGISTER_CONFIG", userId }));
};

let ws: WebSocket | null = null;
let currentChannel: string | null = null;
let reconnectTimeout: any = null;
let reconnectDelay = 1000;
let wasConnected = false;
let isRetrying = false;
let shouldConnect = false;

const waitForPopulate = async fn => {
    while (true) {
        const result = await fn();
        if (result) return result;
        await new Promise(r => setTimeout(r, 500));
    }
};

const stateToPayload = (guildId: string, state: ChannelState) => ({
    userId: state.userId,
    username:
        GuildMemberStore.getNick(guildId, state.userId) ||
        UserStore.getUser(state.userId)?.globalName,
    avatarUrl: UserStore.getUser(state.userId)?.avatar,
    channelId: state.channelId,
    deaf: state.deaf || state.selfDeaf,
    mute: state.mute || state.selfMute,
    streaming: state.selfStream,
    speaking: false,
});

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
    const { id } = UserStore.getCurrentUser();

    for (const state of dispatch.voiceStates) {
        const ourState = state.userId === id;
        const { guildId } = state;

        if (ourState) {
            if (state.channelId && state.channelId !== currentChannel) {
                const voiceStates = await waitForPopulate(() =>
                    VoiceStateStore?.getVoiceStatesForChannel(state.channelId)
                );

                ws?.send(
                    JSON.stringify({
                        cmd: "CHANNEL_JOINED",
                        states: Object.values(voiceStates).map(s => stateToPayload(guildId, s as ChannelState)),
                    })
                );

                currentChannel = state.channelId;

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
                    state: stateToPayload(guildId, state as ChannelState),
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

const cleanWebSocket = () => {
    if (ws) {
        ws.onopen = null;
        ws.onclose = null;
        ws.onerror = null;
        ws.onmessage = null;
        try {
            ws.close();
        } catch (e) { }
        ws = null;
    }
};

const connect = () => {
    if (!shouldConnect) return;

    cleanWebSocket();

    console.log(`[OrbolayBridgeFork] Attempting to connect to Orbolay server (delay: ${reconnectDelay}ms)`);

    ws = new WebSocket("ws://127.0.0.1:" + settings.store.port);

    ws.onopen = async () => {
        console.log("[OrbolayBridgeFork] Connected to Orbolay server");
        wasConnected = true;
        isRetrying = false;
        reconnectDelay = (settings.store.minReconnectDelay ?? 1) * 1000;

        showToast({
            message: "Connected to Orbolay server",
            type: Toasts.Type.SUCCESS,
            id: Toasts.genId(),
        });

        const userId = await waitForPopulate(() => UserStore.getCurrentUser()?.id);
        if (!userId) return;

        sendConfig();

        if (settings.store.sendConnectedNotification) {
            ws?.send(
                JSON.stringify({
                    cmd: "MESSAGE_NOTIFICATION",
                    message: {
                        title: "Connected ✅",
                        body: "Equicord is now connected to Orbolay",
                        icon: "https://raw.githubusercontent.com/Equicord/Equicord/refs/heads/main/browser/icon.png",
                        guildId: "0",
                        channelId: "0",
                        messageId: "0",
                    }
                })
            );
        }

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
                states: Object.values(channelState).map(s => stateToPayload(guildId, s as ChannelState)),
            })
        );

        currentChannel = userVoiceState.channelId;
    };

    ws.onmessage = e => {
        try {
            incoming(JSON.parse(e.data));
        } catch (err) {
            console.error("[OrbolayBridgeFork] Error parsing message:", err);
        }
    };

    ws.onerror = e => {
        console.error("[OrbolayBridgeFork] WebSocket error:", e);
    };

    ws.onclose = () => {
        cleanWebSocket();

        if (wasConnected) {
            console.log("[OrbolayBridgeFork] Disconnected from Orbolay server.");
            wasConnected = false;
            showToast({
                message: "Disconnected from Orbolay server",
                type: Toasts.Type.FAILURE,
                id: Toasts.genId(),
            });
        } else if (!isRetrying) {
            showToast({
                message: "Orbolay websocket could not connect. Is it running?",
                type: Toasts.Type.FAILURE,
                id: Toasts.genId(),
            });
            isRetrying = true;
        }

        if (shouldConnect && settings.store.autoReconnect) {
            const currentDelay = reconnectDelay;
            const maxDelayMs = (settings.store.maxReconnectDelay ?? 60) * 1000;
            const minDelayMs = (settings.store.minReconnectDelay ?? 1) * 1000;
            const multiplier = settings.store.reconnectMultiplier ?? 2;
            reconnectDelay = Math.max(minDelayMs, Math.min(reconnectDelay * multiplier, maxDelayMs));

            reconnectTimeout = setTimeout(() => {
                connect();
            }, currentDelay);
        }
    };
};

export default definePlugin({
    name: "OrbolayBridgeFork",
    description: "Bridge plugin to connect Discord to Orbolay via WebSocket",
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
        shouldConnect = true;
        wasConnected = false;
        isRetrying = false;
        reconnectDelay = (settings.store.minReconnectDelay ?? 1) * 1000;
        connect();
    },

    stop() {
        shouldConnect = false;
        if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
            reconnectTimeout = null;
        }
        cleanWebSocket();
    }
});
