/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { Notice } from "@components/Notice";
import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { ChannelStore, RelationshipStore, SelectedChannelStore, UserStore, VoiceStateStore } from "@webpack/common";

import { ToolBarButton, VoiceTimeIcon } from "./components/ToolBarButton";
import { addLogEntry } from "./logs";
import settings from "./settings";
import {
    channelTimeData,
    currentChannelId,
    currentVoiceUsers,
    flushCurrentSession,
    flushUserSessions,
    joinTimestamp,
    loadData,
    messageCountData,
    save,
    seedExistingUsers,
    setCurrentChannelId,
    setJoinTimestamp,
    userTimeData,
} from "./store";
import { PreviousVoiceState } from "./types";

const previousStates = new Map<string, PreviousVoiceState>();

function shouldLog(userId: string): boolean {
    return !(settings.store.ignoreBlockedUsers && RelationshipStore.isBlocked(userId));
}

export default definePlugin({
    name: "VoiceTimeTracker",
    description: "Track how much time you spend in voice channels. Shows stats broken down by server, channel, and the people you talk to most.",
    tags: ["Voice", "Utility"],
    authors: [EquicordDevs.NOobzy],
    settings,

    settingsAboutComponent: () => (
        <Notice.Info>
            This plugin tracks the time you spend in voice channels and shows detailed stats by server, channel, and user.
        </Notice.Info>
    ),

    headerBarButton: {
        icon: VoiceTimeIcon,
        render: ToolBarButton
    },

    async start() {
        await loadData();
        previousStates.clear();

        const voiceChannelId = SelectedChannelStore.getVoiceChannelId();
        if (voiceChannelId) {
            setCurrentChannelId(voiceChannelId);
            setJoinTimestamp(Date.now());
            seedExistingUsers();

            const states = VoiceStateStore.getVoiceStatesForChannel(voiceChannelId);
            for (const [userId, s] of Object.entries(states)) {
                previousStates.set(userId, {
                    mute: s.mute,
                    deaf: s.deaf,
                    selfVideo: s.selfVideo,
                    selfStream: s.selfStream ?? false,
                    channelId: voiceChannelId,
                });
            }
        }
    },

    stop() {
        flushCurrentSession();
        setJoinTimestamp(null);
        setCurrentChannelId(null);
        currentVoiceUsers.clear();
        previousStates.clear();
    },

    flux: {
        MESSAGE_CREATE({ message, optimistic }: { message: { author: { id: string; }; channel_id: string; }; optimistic?: boolean; }) {
            if (optimistic) return;
            const currentUser = UserStore.getCurrentUser();
            if (!currentUser || message.author?.id !== currentUser.id) return;

            const channel = ChannelStore.getChannel(message.channel_id);
            if (!channel?.guild_id) return;

            messageCountData[channel.guild_id] = (messageCountData[channel.guild_id] ?? 0) + 1;
            save();
        },

        VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: { userId: string; channelId?: string | null; oldChannelId?: string; mute: boolean; deaf: boolean; selfVideo: boolean; selfStream?: boolean; }[]; }) {
            const currentUser = UserStore.getCurrentUser();
            if (!currentUser) return;

            for (const state of voiceStates) {
                if (state.userId === currentUser.id) {
                    if (state.channelId) {
                        if (currentChannelId && currentChannelId !== state.channelId && joinTimestamp) {
                            const elapsed = Date.now() - joinTimestamp;
                            channelTimeData[currentChannelId] = (channelTimeData[currentChannelId] ?? 0) + elapsed;
                            flushUserSessions();
                            currentVoiceUsers.clear();
                            save();
                        }
                        if (currentChannelId !== state.channelId) {
                            setJoinTimestamp(Date.now());
                            setCurrentChannelId(state.channelId);
                            currentVoiceUsers.clear();
                            seedExistingUsers();
                        }
                    } else {
                        if (currentChannelId && joinTimestamp) {
                            const elapsed = Date.now() - joinTimestamp;
                            channelTimeData[currentChannelId] = (channelTimeData[currentChannelId] ?? 0) + elapsed;
                            flushUserSessions();
                            save();
                        }
                        setJoinTimestamp(null);
                        setCurrentChannelId(null);
                        currentVoiceUsers.clear();
                    }
                    continue;
                }

                if (!shouldLog(state.userId)) continue;

                const prev = previousStates.get(state.userId);
                const channelId = state.channelId ?? undefined;
                const { oldChannelId } = state;

                if (oldChannelId !== channelId) {
                    if (!oldChannelId && channelId && channelId === currentChannelId) {
                        if (settings.store.logJoinLeave) {
                            addLogEntry({ type: "join", userId: state.userId, channelId, timestamp: new Date() });
                        }
                    } else if (oldChannelId && !channelId && oldChannelId === currentChannelId) {
                        if (settings.store.logJoinLeave) {
                            addLogEntry({ type: "leave", userId: state.userId, channelId: oldChannelId, timestamp: new Date() });
                        }
                    } else if (oldChannelId && channelId) {
                        if (settings.store.logJoinLeave) {
                            if (oldChannelId === currentChannelId) {
                                addLogEntry({ type: "move", userId: state.userId, channelId: oldChannelId, oldChannelId, newChannelId: channelId, timestamp: new Date() });
                            }
                            if (channelId === currentChannelId) {
                                addLogEntry({ type: "move", userId: state.userId, channelId, oldChannelId, newChannelId: channelId, timestamp: new Date() });
                            }
                        }
                    }
                }

                if (prev && channelId && channelId === currentChannelId) {
                    if (settings.store.logMuteDeafen) {
                        if (state.mute !== prev.mute) {
                            addLogEntry({ type: "server_mute", userId: state.userId, channelId, enabled: state.mute, timestamp: new Date() });
                        }
                        if (state.deaf !== prev.deaf) {
                            addLogEntry({ type: "server_deafen", userId: state.userId, channelId, enabled: state.deaf, timestamp: new Date() });
                        }
                    }
                    if (settings.store.logVideo && state.selfVideo !== prev.selfVideo) {
                        addLogEntry({ type: "self_video", userId: state.userId, channelId, enabled: state.selfVideo, timestamp: new Date() });
                    }
                    if (settings.store.logStream && (state.selfStream ?? false) !== prev.selfStream) {
                        addLogEntry({ type: "self_stream", userId: state.userId, channelId, enabled: state.selfStream ?? false, timestamp: new Date() });
                    }
                }

                previousStates.set(state.userId, {
                    mute: state.mute,
                    deaf: state.deaf,
                    selfVideo: state.selfVideo,
                    selfStream: state.selfStream ?? false,
                    channelId,
                });

                if (!channelId) {
                    previousStates.delete(state.userId);
                }

                if (!currentChannelId) continue;

                if (state.channelId === currentChannelId) {
                    if (!currentVoiceUsers.has(state.userId)) {
                        currentVoiceUsers.set(state.userId, Date.now());
                    }
                } else if (currentVoiceUsers.has(state.userId)) {
                    const startTime = currentVoiceUsers.get(state.userId)!;
                    const elapsed = Date.now() - startTime;
                    const key = `${state.userId}:${currentChannelId}`;
                    userTimeData[key] = (userTimeData[key] ?? 0) + elapsed;
                    currentVoiceUsers.delete(state.userId);
                    save();
                }
            }
        }
    }
});
