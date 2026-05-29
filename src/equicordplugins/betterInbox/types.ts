/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Message, ReactionEmoji } from "@vencord/discord-types";

export type ActivityKind =
    | "reply"
    | "reaction"
    | "forum-reply"
    | "thread-created"
    | "pinned"
    | "group-add"
    | "blocked-mention"
    | "mention-edit"
    | "friend-request"
    | "friend-added"
    | "scheduled-event";

export interface ActivityMeta {
    emoji?: ReactionEmoji;
    originalContent?: string;
    threadName?: string;
    threadId?: string;
    pinnedContent?: string;
    pinnerName?: string;
    groupName?: string;
    threadOrForumName?: string;
    friendName?: string;
    eventName?: string;
    eventGuildName?: string;
    eventStartTime?: string;
}

export interface RawAuthor {
    id: string;
    username?: string;
    global_name?: string;
    discriminator?: string;
    avatar?: string | null;
    bot?: boolean;
    public_flags?: number;
}

interface MessageReference {
    message_id?: string;
    channel_id?: string;
    guild_id?: string;
}

export interface RawMessage {
    id: string;
    type?: number;
    channel_id: string;
    guild_id?: string;
    author?: RawAuthor;
    content?: string;
    timestamp?: string;
    edited_timestamp?: string | null;
    editedTimestamp?: string | null;
    mention_everyone?: boolean;
    mentions?: Array<{ id: string; } | string>;
    mention_roles?: string[];
    message_reference?: MessageReference;
    messageReference?: MessageReference;
    referenced_message?: RawMessage | null;
    referencedMessage?: RawMessage | null;
}

export type InboxRecord = Message & {
    _betterInboxKind?: ActivityKind;
    _betterInboxMeta?: ActivityMeta;
    _betterInbox?: { id: string; };
};

export interface StoredEntry {
    kind: ActivityKind;
    id: string;
    raw: RawMessage;
    meta?: ActivityMeta;
    record: InboxRecord;
    read?: boolean;
}

export type StoredEntrySnapshot = Omit<StoredEntry, "record">;

export interface TabConfig {
    id: number;
    label: string;
    settingKey: "showAllTab" | "showMentionsTab" | "showReactionsTab" | "showActivityTab";
    kinds: ActivityKind[] | null;
    includeDiscordMentions?: boolean;
}

export interface SyntheticOpts {
    id: string;
    channelId: string;
    author: RawAuthor;
    content: string;
    referenceChannelId?: string;
    referenceMessageId?: string;
    referenceGuildId?: string;
}

export interface AnyUser {
    id?: string;
    username?: string;
    globalName?: string | null;
    global_name?: string | null;
    discriminator?: string;
    avatar?: string | null;
    bot?: boolean;
    publicFlags?: number;
    public_flags?: number;
}

export interface MessagePayload {
    message?: RawMessage;
}

export interface ReactionAddPayload {
    channelId: string;
    messageId: string;
    messageAuthorId: string;
    userId: string;
    emoji: ReactionEmoji;
    optimistic?: boolean;
}

interface ThreadInfo {
    id: string;
    name?: string;
    parent_id?: string;
    parentId?: string;
    owner_id?: string;
    ownerId?: string;
    newlyCreated?: boolean;
    newly_created?: boolean;
}

export interface ThreadCreatePayload {
    thread?: ThreadInfo;
    newlyCreated?: boolean;
    newly_created?: boolean;
}

interface CreatedChannelInfo {
    id: string;
    type: number;
    name?: string;
    owner_id?: string;
    ownerId?: string;
}

export interface ChannelCreatePayload {
    channel?: CreatedChannelInfo;
}

interface RelationshipInfo {
    id?: string;
    type?: number;
    user?: AnyUser;
}

export interface RelationshipAddPayload {
    relationship?: RelationshipInfo;
}

interface ScheduledEventInfo {
    id: string;
    name?: string;
    guild_id?: string;
    guildId?: string;
    creator_id?: string;
    creatorId?: string;
    channel_id?: string;
    channelId?: string;
    scheduled_start_time?: string;
    scheduledStartTime?: string;
}

export interface ScheduledEventCreatePayload {
    guildScheduledEvent?: ScheduledEventInfo;
    guild_scheduled_event?: ScheduledEventInfo;
}
