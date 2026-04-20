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
    dmMessageCountData,
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
import { LogEntry, PreviousVoiceState } from "./types";

const previousStates = new Map<string, PreviousVoiceState>();
const existingUsers = new Set<string>();
let clientOldChannelId: string | undefined;

function isMyChannel(channelId?: string): boolean {
    return !!channelId && SelectedChannelStore.getVoiceChannelId() === channelId;
}

function shouldLog(userId: string): boolean {
    return !(settings.store.ignoreBlockedUsers && RelationshipStore.isBlocked(userId));
}

function log(entry: Omit<LogEntry, "timestamp">) {
    addLogEntry({ ...entry, timestamp: new Date() });
}

export default definePlugin({
    name: "Insights",
    description: "Track voice time, message counts, and activity across servers, channels, friends, and users — all in one dashboard.",
    tags: ["Voice", "Utility"],
    authors: [EquicordDevs.NOobzy],
    settings,

    settingsAboutComponent: () => (
        <Notice.Info>
            This plugin tracks voice time, messages, and activity across servers, channels, and friends.
        </Notice.Info>
    ),

    headerBarButton: {
        icon: VoiceTimeIcon,
        render: ToolBarButton
    },

    async start() {
        await loadData();
        previousStates.clear();
        existingUsers.clear();

        clientOldChannelId = SelectedChannelStore.getVoiceChannelId() ?? undefined;
        if (clientOldChannelId) {
            setCurrentChannelId(clientOldChannelId);
            setJoinTimestamp(Date.now());
            seedExistingUsers();

            if (settings.store.logJoinLeave) {
                log({ type: "join", userId: UserStore.getCurrentUser().id, channelId: clientOldChannelId });
            }

            const states = VoiceStateStore.getVoiceStatesForChannel(clientOldChannelId);
            for (const [userId, s] of Object.entries(states)) {
                existingUsers.add(userId);
                previousStates.set(userId, {
                    mute: s.mute,
                    deaf: s.deaf,
                    selfMute: s.selfMute,
                    selfDeaf: s.selfDeaf,
                    selfVideo: s.selfVideo,
                    selfStream: s.selfStream ?? false,
                    channelId: clientOldChannelId,
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
        existingUsers.clear();
    },

    flux: {
        MESSAGE_CREATE({ message, optimistic }: { message: { author: { id: string; }; channel_id: string; }; optimistic?: boolean; }) {
            if (optimistic) return;
            const currentUser = UserStore.getCurrentUser();
            if (!currentUser || message.author?.id !== currentUser.id) return;

            const channel = ChannelStore.getChannel(message.channel_id);
            if (!channel) return;

            if (channel.guild_id) {
                messageCountData[channel.guild_id] = (messageCountData[channel.guild_id] ?? 0) + 1;
            }

            if (channel.isDM()) {
                const recipientId = channel.getRecipientId();
                if (recipientId) {
                    dmMessageCountData[recipientId] = (dmMessageCountData[recipientId] ?? 0) + 1;
                }
            }

            save();
        },

        VOICE_CHANNEL_SELECT({ channelId, currentVoiceChannelId }: { channelId: string | null; currentVoiceChannelId: string | null; }) {
            const leaving = channelId == null && currentVoiceChannelId != null;
            const joining = channelId != null && currentVoiceChannelId == null;
            const oldChannel = currentVoiceChannelId ?? clientOldChannelId;

            clientOldChannelId = channelId ?? undefined;

            if (leaving && oldChannel) {
                if (settings.store.logJoinLeave) {
                    log({ type: "leave", userId: UserStore.getCurrentUser().id, channelId: oldChannel });
                }
            } else if (joining && channelId && channelId !== oldChannel) {
                if (settings.store.logJoinLeave) {
                    log({ type: "join", userId: UserStore.getCurrentUser().id, channelId });
                }
            }
        },

        VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: { userId: string; channelId?: string | null; oldChannelId?: string; mute: boolean; deaf: boolean; selfMute: boolean; selfDeaf: boolean; selfVideo: boolean; selfStream?: boolean; }[]; }) {
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
                if (!("oldChannelId" in state)) continue;

                const { channelId, oldChannelId } = state;

                if (oldChannelId === channelId && !previousStates.has(state.userId)) {
                    previousStates.set(state.userId, {
                        mute: state.mute,
                        deaf: state.deaf,
                        selfMute: state.selfMute,
                        selfDeaf: state.selfDeaf,
                        selfVideo: state.selfVideo,
                        selfStream: state.selfStream ?? false,
                        channelId: channelId ?? undefined,
                    });
                    continue;
                }

                const prev = previousStates.get(state.userId);
                const inMyChannel = isMyChannel(channelId ?? undefined) || isMyChannel(oldChannelId);

                if (oldChannelId !== channelId) {
                    if (!oldChannelId && channelId) {
                        const skipJoin = existingUsers.delete(state.userId);
                        if (!skipJoin && settings.store.logJoinLeave && isMyChannel(channelId)) {
                            log({ type: "join", userId: state.userId, channelId });
                        }
                    } else if (oldChannelId && !channelId) {
                        if (settings.store.logJoinLeave && isMyChannel(oldChannelId)) {
                            log({ type: "leave", userId: state.userId, channelId: oldChannelId });
                        }
                    } else if (oldChannelId && channelId) {
                        if (settings.store.logJoinLeave) {
                            if (isMyChannel(oldChannelId)) {
                                log({ type: "move", userId: state.userId, channelId: oldChannelId, oldChannelId, newChannelId: channelId });
                            }
                            if (isMyChannel(channelId)) {
                                log({ type: "move", userId: state.userId, channelId, oldChannelId, newChannelId: channelId });
                            }
                        }
                    }
                }

                if (prev && channelId && inMyChannel) {
                    if (settings.store.logMuteDeafen) {
                        if (state.mute !== prev.mute) {
                            log({ type: "server_mute", userId: state.userId, channelId, enabled: state.mute });
                        }
                        if (state.deaf !== prev.deaf) {
                            log({ type: "server_deafen", userId: state.userId, channelId, enabled: state.deaf });
                        }
                    }
                    if (settings.store.logSelfMuteDeafen) {
                        if (state.selfMute !== prev.selfMute) {
                            log({ type: "self_mute", userId: state.userId, channelId, enabled: state.selfMute });
                        }
                        if (state.selfDeaf !== prev.selfDeaf) {
                            log({ type: "self_deafen", userId: state.userId, channelId, enabled: state.selfDeaf });
                        }
                    }
                    if (settings.store.logVideo && state.selfVideo !== prev.selfVideo) {
                        log({ type: "self_video", userId: state.userId, channelId, enabled: state.selfVideo });
                    }
                    if (settings.store.logStream && (state.selfStream ?? false) !== prev.selfStream) {
                        log({ type: "self_stream", userId: state.userId, channelId, enabled: state.selfStream ?? false });
                    }
                }

                previousStates.set(state.userId, {
                    mute: state.mute,
                    deaf: state.deaf,
                    selfMute: state.selfMute,
                    selfDeaf: state.selfDeaf,
                    selfVideo: state.selfVideo,
                    selfStream: state.selfStream ?? false,
                    channelId: channelId ?? undefined,
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
