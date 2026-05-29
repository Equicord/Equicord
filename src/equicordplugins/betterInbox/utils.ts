/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DataStore } from "@api/index";
import { Logger } from "@utils/Logger";
import { findByCodeLazy, findStoreLazy } from "@webpack";
import { ChannelStore, lodash, MessageStore, ReadStateUtils, RelationshipStore, UserGuildSettingsStore, UserStore } from "@webpack/common";

import { settings } from "./settings";
import { ActivityKind, ActivityMeta, AnyUser, InboxRecord, RawAuthor, RawMessage, StoredEntry, StoredEntrySnapshot, SyntheticOpts, TabConfig } from "./types";

const logger = new Logger("BetterInbox");
const LOG_KEY = "BetterInbox_log_v2";

const RecentMentionsStore: { getMentions(): InboxRecord[]; } = findStoreLazy("RecentMentionsStore");
const createMessageRecord: (raw: RawMessage) => InboxRecord = findByCodeLazy(".createFromServer(", ".isBlockedForMessage", "messageReference:");

export const TABS: TabConfig[] = [
    { id: 9, label: "All", settingKey: "showAllTab", kinds: null, includeDiscordMentions: true },
    { id: 10, label: "Mentions", settingKey: "showMentionsTab", kinds: ["reply", "blocked-mention", "mention-edit"], includeDiscordMentions: true },
    { id: 11, label: "Reactions", settingKey: "showReactionsTab", kinds: ["reaction"] },
    { id: 12, label: "Activity", settingKey: "showActivityTab", kinds: ["thread-created", "forum-reply", "pinned", "group-add", "friend-request", "friend-added", "scheduled-event"] }
];

let activityLog: StoredEntry[] = [];
export const logSubscribers = new Set<() => void>();
export const userMessagedChannelIds = new Set<string>();

export function getActivityLog(): StoredEntry[] {
    return activityLog;
}

export function notifyLogChange() {
    for (const cb of logSubscribers) {
        try { cb(); } catch (err) { logger.error("subscriber error", err); }
    }
}

export function shortenContent(content: string, max = 100): string {
    if (!content) return "";
    const oneLine = content.replace(/\s+/g, " ").trim();
    return oneLine.length > max ? oneLine.slice(0, max - 1) + "…" : oneLine;
}

export function userToJson(user: AnyUser | undefined, fallbackId?: string): RawAuthor {
    if (!user) return { id: fallbackId ?? "0", username: "Unknown", discriminator: "0000", avatar: null, bot: false };
    return {
        id: user.id ?? fallbackId ?? "0",
        username: user.username ?? "Unknown",
        global_name: user.globalName ?? user.global_name ?? undefined,
        discriminator: user.discriminator ?? "0000",
        avatar: user.avatar ?? null,
        bot: !!user.bot,
        public_flags: user.publicFlags ?? user.public_flags ?? 0
    };
}

export function makeSyntheticRaw(opts: SyntheticOpts): RawMessage {
    const guildId = opts.referenceGuildId ?? ChannelStore.getChannel(opts.channelId)?.guild_id;
    return {
        id: opts.id,
        type: 0,
        channel_id: opts.channelId,
        author: opts.author,
        content: opts.content,
        timestamp: new Date().toISOString(),
        edited_timestamp: null,
        mention_everyone: false,
        mentions: [],
        mention_roles: [],
        message_reference: opts.referenceMessageId ? {
            channel_id: opts.referenceChannelId ?? opts.channelId,
            message_id: opts.referenceMessageId,
            guild_id: guildId
        } : undefined,
        referenced_message: null
    };
}

function entryTimestamp(e: StoredEntry): number {
    const t = e.raw.timestamp;
    return t ? Date.parse(t) : 0;
}

function recordTimestamp(rec: InboxRecord): number {
    const t = rec.timestamp as Date | string | undefined;
    if (!t) return 0;
    return typeof t === "string" ? Date.parse(t) : t.valueOf();
}

function buildRecord(raw: RawMessage, kind: ActivityKind, meta?: ActivityMeta): InboxRecord | null {
    try {
        const rec = createMessageRecord(raw);
        rec._betterInboxKind = kind;
        if (meta) rec._betterInboxMeta = meta;
        return rec;
    } catch (err) {
        logger.error("createMessageRecord failed", err);
        return null;
    }
}

function persist() {
    const toSave: StoredEntrySnapshot[] = activityLog.map(e => ({
        kind: e.kind,
        id: e.id,
        raw: e.raw,
        meta: e.meta,
        read: !!e.read
    }));
    DataStore.set(LOG_KEY, toSave).catch(err => logger.error("persist failed", err));
}

export function markAllRead(): boolean {
    let changed = false;
    for (const e of activityLog) {
        if (!e.read) {
            e.read = true;
            changed = true;
        }
    }
    if (changed) persist();
    return changed;
}

export function markEntryRead(id: string, ack = false) {
    const entry = activityLog.find(e => e.id === id);
    if (!entry || entry.read) return;
    entry.read = true;
    if (ack) {
        const channel = ChannelStore.getChannel(entry.raw.channel_id);
        if (channel) ReadStateUtils.ackChannel(channel);
    }
    persist();
    notifyLogChange();
}

export function pushEntry(kind: ActivityKind, id: string, raw: RawMessage, meta?: ActivityMeta) {
    if (activityLog.some(e => e.id === id)) return;
    const cleanRaw = lodash.cloneDeep(raw);
    const cleanMeta = meta ? lodash.cloneDeep(meta) : undefined;
    const record = buildRecord(cleanRaw, kind, cleanMeta);
    if (!record) return;

    activityLog.push({ kind, id, raw: cleanRaw, meta: cleanMeta, record, read: false });
    activityLog.sort((a, b) => entryTimestamp(b) - entryTimestamp(a));

    const limit = Number(settings.store.amountToKeep) | 0;
    if (limit > 0) {
        while (activityLog.length > limit) activityLog.pop();
    }

    persist();
    notifyLogChange();
}

export function deleteEntry(id: string) {
    const before = activityLog.length;
    activityLog = activityLog.filter(e => e.id !== id);
    if (activityLog.length !== before) {
        persist();
        notifyLogChange();
    }
}

export function clearTab(tabId: number) {
    const cfg = TABS.find(t => t.id === tabId);
    if (!cfg) return;
    if (cfg.kinds === null) {
        activityLog = [];
    } else {
        const allowed = new Set(cfg.kinds);
        activityLog = activityLog.filter(e => !allowed.has(e.kind));
    }
    persist();
    notifyLogChange();
}

function shouldDropForFilters(record: InboxRecord): boolean {
    if (settings.store.ignoreEveryoneAndRoleMentions) {
        const selfId = UserStore.getCurrentUser()?.id;
        if (selfId) {
            const { mentionEveryone, mentionRoles, mentions } = record;
            const hasRoleMention = Array.isArray(mentionRoles) && mentionRoles.length > 0;
            const directlyMentioned = Array.isArray(mentions) && mentions.includes(selfId);
            if ((mentionEveryone || hasRoleMention) && !directlyMentioned) return true;
        }
    }

    if (settings.store.ignoreMutedServers) {
        const guildId = ChannelStore.getChannel(record.channel_id)?.guild_id;
        if (guildId && UserGuildSettingsStore.isMuted(guildId)) return true;
    }

    return false;
}

export function getDisplayMessages(tabId: number): InboxRecord[] {
    const cfg = TABS.find(t => t.id === tabId);
    if (!cfg) return [];

    let records: InboxRecord[];
    if (cfg.kinds === null) {
        records = activityLog.map(e => e.record);
    } else {
        const allowed = new Set(cfg.kinds);
        records = activityLog.filter(e => allowed.has(e.kind)).map(e => e.record);
    }

    if (cfg.includeDiscordMentions && settings.store.includeDiscordMentions) {
        const native = RecentMentionsStore.getMentions();
        if (Array.isArray(native) && native.length) records = [...records, ...native];
    }

    return records
        .filter(r => !shouldDropForFilters(r))
        .sort((a, b) => recordTimestamp(b) - recordTimestamp(a));
}

function isReplyToMe(message: RawMessage, selfId: string): boolean {
    const ref = message.message_reference ?? message.messageReference;
    if (!ref?.message_id) return false;
    const refMsg = message.referenced_message ?? message.referencedMessage;
    let originalAuthorId = refMsg?.author?.id;
    if (!originalAuthorId) {
        const stored = MessageStore.getMessage(ref.channel_id ?? message.channel_id, ref.message_id);
        originalAuthorId = stored?.author.id;
    }
    return originalAuthorId === selfId;
}

function mentionsUser(message: RawMessage, userId: string): boolean {
    const mentions = message.mentions ?? [];
    return mentions.some(m => (typeof m === "string" ? m : m.id) === userId);
}

function handleSilentReply(message: RawMessage, selfId: string): boolean {
    if (!settings.store.includeReplies) return false;
    if (settings.store.ignoreSelf && message.author?.id === selfId) return false;
    if (settings.store.ignoreBots && message.author?.bot) return false;
    if (!isReplyToMe(message, selfId)) return false;
    if (mentionsUser(message, selfId)) return false;
    pushEntry("reply", "reply:" + message.id, message);
    return true;
}

function handleForumReply(message: RawMessage, selfId: string): boolean {
    if (!settings.store.includeForumReplies) return false;
    if (message.author?.id === selfId) return false;
    if (settings.store.ignoreBots && message.author?.bot) return false;
    const channel = ChannelStore.getChannel(message.channel_id);
    if (!channel) return false;
    if (channel.type !== 10 && channel.type !== 11 && channel.type !== 12) return false;

    let isRelevant = channel.ownerId === selfId;
    if (!isRelevant && channel.parent_id) {
        const originMsg = MessageStore.getMessage(channel.parent_id, channel.id);
        if (originMsg?.author.id === selfId) isRelevant = true;
    }
    if (!isRelevant && channel.member) isRelevant = true;
    if (!isRelevant && userMessagedChannelIds.has(channel.id)) isRelevant = true;
    if (!isRelevant && channel.memberIdsPreview?.includes(selfId)) isRelevant = true;
    if (!isRelevant) return false;

    pushEntry("forum-reply", "forum:" + message.id, message, { threadOrForumName: channel.name });
    return true;
}

function handlePinSystemMessage(message: RawMessage, selfId: string): boolean {
    if (!settings.store.includePins) return false;
    if (message.type !== 6) return false;
    const ref = message.message_reference;
    if (!ref?.message_id) return false;
    const pinned = MessageStore.getMessage(ref.channel_id ?? message.channel_id, ref.message_id);
    if (!pinned) return false;
    if (pinned.author.id !== selfId) return false;
    pushEntry("pinned", "pin:" + message.id, message, {
        pinnedContent: pinned.content,
        pinnerName: message.author?.global_name ?? message.author?.username ?? ""
    });
    return true;
}

function handleBlockedMention(message: RawMessage, selfId: string): boolean {
    if (!settings.store.includeBlockedMentions) return false;
    if (!message.author?.id) return false;
    if (!RelationshipStore.isBlocked(message.author.id)) return false;
    if (!mentionsUser(message, selfId)) return false;
    pushEntry("blocked-mention", "blocked:" + message.id, message);
    return true;
}

function handleMentionEdit(message: RawMessage, selfId: string): boolean {
    if (!settings.store.includeMentionEdits) return false;
    const editedTs = message.edited_timestamp ?? message.editedTimestamp;
    if (!editedTs) return false;
    if (message.author?.id === selfId) return false;
    if (settings.store.ignoreBots && message.author?.bot) return false;
    if (!mentionsUser(message, selfId)) return false;
    pushEntry("mention-edit", `edit:${message.id}:${editedTs}`, message);
    return true;
}

export function processMessageCreate(message: RawMessage | undefined) {
    if (!message) return;
    const selfId = UserStore.getCurrentUser()?.id;
    if (!selfId) return;
    if (message.type === 6) {
        handlePinSystemMessage(message, selfId);
        return;
    }
    if (handleSilentReply(message, selfId)) return;
    if (handleBlockedMention(message, selfId)) return;
    handleForumReply(message, selfId);
}

export function processMessageUpdate(message: RawMessage | undefined) {
    if (!message) return;
    const selfId = UserStore.getCurrentUser()?.id;
    if (!selfId) return;
    handleMentionEdit(message, selfId);
}

export async function loadActivityLog() {
    const raw = (await DataStore.get<StoredEntrySnapshot[]>(LOG_KEY)) ?? [];
    activityLog = [];
    for (const entry of raw) {
        if (!entry?.raw) continue;
        const record = buildRecord(entry.raw, entry.kind, entry.meta);
        if (!record) continue;
        activityLog.push({
            kind: entry.kind,
            id: entry.id,
            raw: entry.raw,
            meta: entry.meta,
            record,
            read: !!entry.read
        });
    }
    activityLog.sort((a, b) => entryTimestamp(b) - entryTimestamp(a));
}
