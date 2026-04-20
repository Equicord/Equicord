/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export type LogEventType =
    | "join"
    | "leave"
    | "move"
    | "server_mute"
    | "server_deafen"
    | "self_video"
    | "self_stream";

export interface LogEntry {
    type: LogEventType;
    userId: string;
    channelId: string;
    timestamp: Date;
    oldChannelId?: string | null;
    newChannelId?: string | null;
    enabled?: boolean;
}

export interface PreviousVoiceState {
    mute: boolean;
    deaf: boolean;
    selfVideo: boolean;
    selfStream: boolean;
    channelId?: string;
}

export interface GuildRow {
    guildId: string;
    name: string;
    totalMs: number;
}

export interface ChannelRow {
    channelId: string;
    guildId: string;
    guildName: string;
    channelName: string;
    totalMs: number;
}

export interface UserChannelRow {
    userId: string;
    channelId: string;
    totalMs: number;
}

export interface FriendRow {
    userId: string;
    totalMs: number;
}
