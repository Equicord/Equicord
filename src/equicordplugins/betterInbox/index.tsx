/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import hideNativesStyle from "./hideNatives.css?managed";
import unreadBadgeStyle from "./unreadBadge.css?managed";

import { DataStore } from "@api/index";
import { definePluginSettings } from "@api/Settings";
import { disableStyle, enableStyle, setStyleClassNames } from "@api/Styles";
import { Button } from "@components/Button";
import { EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { classes } from "@utils/misc";
import definePlugin, { OptionType } from "@utils/types";
import { ReactionEmoji, User } from "@vencord/discord-types";
import { findByCodeLazy, findCssClassesLazy, findStoreLazy } from "@webpack";
import {
    ChannelStore,
    ContextMenuApi,
    FluxDispatcher,
    GuildStore,
    Menu,
    MessageStore,
    ReadStateUtils,
    RelationshipStore,
    SelectedChannelStore,
    TabBar,
    Tooltip,
    useEffect,
    UserGuildSettingsStore,
    useState,
    UserStore
} from "@webpack/common";

const recentMentionsPopoutClass = findCssClassesLazy("recentMentionsPopout", "scroller");
const tabClass = findCssClassesLazy("inboxTitle", "tab");
const Popout = findByCodeLazy("getProTip", "canCloseAllMessages:");
const createMessageRecord = findByCodeLazy(".createFromServer(", ".isBlockedForMessage", "messageReference:");
const RecentMentionsStore: any = findStoreLazy("RecentMentionsStore");

const LOG_KEY = "BetterInbox_log_v2";
const MIN_TAB_ID = 9;
const MAX_TAB_ID = 12;
const cl = classNameFactory("vc-betterinbox-");
const OUR_TAB_MARKER_CLASS = "vc-betterinbox-our-tab";

type ActivityKind =
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

interface ActivityMeta {
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

interface StoredEntry {
    kind: ActivityKind;
    id: string;
    raw: any;
    meta?: ActivityMeta;
    record: any;
    read?: boolean;
}

interface TabConfig {
    id: number;
    label: string;
    settingKey: "showAllTab" | "showMentionsTab" | "showReactionsTab" | "showActivityTab";
    kinds: ActivityKind[] | null;
    includeDiscordMentions?: boolean;
}

const TABS: TabConfig[] = [
    { id: 9, label: "All", settingKey: "showAllTab", kinds: null, includeDiscordMentions: true },
    { id: 10, label: "Mentions", settingKey: "showMentionsTab", kinds: ["reply", "blocked-mention", "mention-edit"], includeDiscordMentions: true },
    { id: 11, label: "Reactions", settingKey: "showReactionsTab", kinds: ["reaction"] },
    { id: 12, label: "Activity", settingKey: "showActivityTab", kinds: ["thread-created", "forum-reply", "pinned", "group-add", "friend-request", "friend-added", "scheduled-event"] }
];

let activityLog: StoredEntry[] = [];
let interceptor: ((e: any) => any) | null = null;
let onLogChange: () => void = () => { };

const settings = definePluginSettings({
    showAllTab: { type: OptionType.BOOLEAN, description: "Show 'All' tab", default: false },
    showMentionsTab: { type: OptionType.BOOLEAN, description: "Show 'Mentions' tab (replies, blocked mentions, edits to messages mentioning you, native @-mentions)", default: true },
    showReactionsTab: { type: OptionType.BOOLEAN, description: "Show 'Reactions' tab", default: true },
    showActivityTab: { type: OptionType.BOOLEAN, description: "Show 'Activity' tab (threads, pins, group invites, friend requests, scheduled events)", default: false },
    hideNativeTabs: {
        type: OptionType.BOOLEAN,
        description: "Hide Discord's native inbox tabs (Unreads / Mentions). Discord's @-mentions are merged into our Activity tab so you don't lose them.",
        default: true
    },
    includeDiscordMentions: {
        type: OptionType.BOOLEAN,
        description: "Merge Discord's native @-mentions into the Activity tab",
        default: true
    },

    // Capture toggles
    includeReplies: { type: OptionType.BOOLEAN, description: "Silent replies to your messages (Discord shows mentioned replies in its native inbox already)", default: true },
    includeForumReplies: { type: OptionType.BOOLEAN, description: "New messages in threads / forum posts you started", default: true },
    includeReactions: { type: OptionType.BOOLEAN, description: "Reactions on your messages", default: true },
    includeThreadCreations: { type: OptionType.BOOLEAN, description: "Threads created from your messages", default: true },
    includePins: { type: OptionType.BOOLEAN, description: "Pins on your messages", default: true },
    includeMentionEdits: { type: OptionType.BOOLEAN, description: "Edits to messages mentioning you", default: true },
    includeBlockedMentions: { type: OptionType.BOOLEAN, description: "Mentions from blocked users (Discord hides these)", default: false },
    includeGroupDmAdds: { type: OptionType.BOOLEAN, description: "Being added to group DMs", default: true },
    includeFriendRequests: { type: OptionType.BOOLEAN, description: "Incoming friend requests", default: true },
    includeFriendAdded: { type: OptionType.BOOLEAN, description: "New friendships", default: true },
    includeScheduledEvents: { type: OptionType.BOOLEAN, description: "New server scheduled events", default: false },

    // Filters
    ignoreBots: { type: OptionType.BOOLEAN, description: "Ignore replies / reactions / edits from bots", default: true },
    ignoreSelf: { type: OptionType.BOOLEAN, description: "Ignore your own actions on your own messages", default: true },
    ignoreEveryoneAndRoleMentions: {
        type: OptionType.BOOLEAN,
        description: "Hide @everyone, @here, and role mentions (unless you are also directly @-mentioned)",
        default: false
    },
    ignoreMutedServers: {
        type: OptionType.BOOLEAN,
        description: "Hide notifications from servers you have muted",
        default: false
    },
    amountToKeep: { type: OptionType.NUMBER, description: "Max entries to keep (0 = unlimited)", default: 0 }
});

// =================== Helpers ===================

function getCurrentUserId() { return UserStore.getCurrentUser()?.id; }

function shortenContent(content: string, max = 100) {
    if (!content) return "";
    const oneLine = content.replace(/\s+/g, " ").trim();
    return oneLine.length > max ? oneLine.slice(0, max - 1) + "…" : oneLine;
}

function safeClone<T>(obj: T): T | null {
    try { return JSON.parse(JSON.stringify(obj)); } catch { return null; }
}

function userToJson(user: any, fallbackId?: string) {
    if (!user) return { id: fallbackId ?? "0", username: "Unknown", discriminator: "0000", avatar: null, bot: false };
    return {
        id: user.id,
        username: user.username ?? "Unknown",
        global_name: user.globalName ?? user.global_name,
        discriminator: user.discriminator ?? "0000",
        avatar: user.avatar ?? null,
        bot: !!user.bot,
        public_flags: user.publicFlags ?? user.public_flags ?? 0
    };
}

function makeSyntheticRaw(opts: {
    id: string;
    channelId: string;
    author: any;
    content: string;
    referenceChannelId?: string;
    referenceMessageId?: string;
    referenceGuildId?: string;
}) {
    const guildId = opts.referenceGuildId ?? ChannelStore.getChannel(opts.channelId)?.guild_id;
    return {
        id: opts.id,
        type: 0,
        channel_id: opts.channelId,
        author: opts.author,
        content: opts.content,
        timestamp: new Date().toISOString(),
        edited_timestamp: null,
        tts: false,
        mention_everyone: false,
        mentions: [],
        mention_roles: [],
        attachments: [],
        embeds: [],
        pinned: false,
        flags: 0,
        components: [],
        message_reference: opts.referenceMessageId ? {
            channel_id: opts.referenceChannelId ?? opts.channelId,
            message_id: opts.referenceMessageId,
            guild_id: guildId
        } : undefined,
        referenced_message: null
    };
}

// =================== Storage ===================

function persist() {
    const toSave = activityLog.map(e => ({ kind: e.kind, id: e.id, raw: e.raw, meta: e.meta, read: !!e.read }));
    DataStore.set(LOG_KEY, toSave).catch(err => console.error("[BetterInbox] persist failed", err));
}

function unreadCount(): number {
    return activityLog.reduce((n, e) => n + (e.read ? 0 : 1), 0);
}

function syncUnreadBadge() {
    if (unreadCount() > 0) enableStyle(unreadBadgeStyle);
    else disableStyle(unreadBadgeStyle);
}

function markAllRead(): boolean {
    let changed = false;
    for (const e of activityLog) {
        if (!e.read) { e.read = true; changed = true; }
    }
    if (changed) {
        persist();
        syncUnreadBadge();
    }
    return changed;
}

function markEntryRead(id: string, ack = false) {
    const entry = activityLog.find(e => e.id === id);
    if (!entry || entry.read) return;
    entry.read = true;
    if (ack) {
        try {
            const channel = ChannelStore.getChannel(entry.raw?.channel_id);
            if (channel) ReadStateUtils.ackChannel(channel);
        } catch (err) {
            console.error("[BetterInbox] ackChannel failed", err);
        }
    }
    persist();
    syncUnreadBadge();
    onLogChange();
}

function buildRecord(raw: any, kind: ActivityKind, meta?: ActivityMeta): any | null {
    try {
        const rec = createMessageRecord(raw);
        rec._betterInboxKind = kind;
        if (meta) rec._betterInboxMeta = meta;
        return rec;
    } catch (err) {
        console.error("[BetterInbox] createMessageRecord failed", err);
        return null;
    }
}

function entryTimestamp(e: StoredEntry): number {
    const t = e.raw?.timestamp;
    if (!t) return 0;
    return typeof t === "string" ? Date.parse(t) : (t.getTime?.() ?? 0);
}

function recordTimestamp(rec: any): number {
    const t = rec?.timestamp;
    if (!t) return 0;
    if (typeof t === "string") return Date.parse(t);
    if (typeof t.getTime === "function") return t.getTime();
    if (typeof t.toDate === "function") return t.toDate().getTime();
    return 0;
}

function pushEntry(kind: ActivityKind, id: string, raw: any, meta?: ActivityMeta) {
    if (activityLog.some(e => e.id === id)) return;
    const cleanRaw = safeClone(raw);
    if (!cleanRaw) return;
    const cleanMeta = meta ? safeClone(meta) ?? undefined : undefined;
    const record = buildRecord(cleanRaw, kind, cleanMeta);
    if (!record) return;

    activityLog.push({ kind, id, raw: cleanRaw, meta: cleanMeta, record, read: false });
    activityLog.sort((a, b) => entryTimestamp(b) - entryTimestamp(a));

    const limit = Number(settings.store.amountToKeep) | 0;
    if (limit > 0) {
        while (activityLog.length > limit) activityLog.pop();
    }

    persist();
    syncUnreadBadge();
    onLogChange();
}

function deleteEntry(id: string) {
    const before = activityLog.length;
    activityLog = activityLog.filter(e => e.id !== id);
    if (activityLog.length !== before) {
        persist();
        syncUnreadBadge();
        onLogChange();
    }
}

function clearAll() {
    activityLog = [];
    persist();
    syncUnreadBadge();
    onLogChange();
}

function clearTab(tabId: number) {
    const cfg = TABS.find(t => t.id === tabId);
    if (!cfg) return;
    if (cfg.kinds === null) {
        activityLog = [];
    } else {
        const allowed = new Set(cfg.kinds);
        activityLog = activityLog.filter(e => !allowed.has(e.kind));
    }
    persist();
    syncUnreadBadge();
    onLogChange();
}

function isDirectlyMentioned(msg: any, userId: string): boolean {
    const mentions: any[] = msg?.mentions ?? [];
    return mentions.some(m => (typeof m === "string" ? m : m?.id) === userId);
}

function shouldDropForFilters(msg: any): boolean {
    if (settings.store.ignoreEveryoneAndRoleMentions) {
        const selfId = getCurrentUserId();
        const everyone = msg?.mention_everyone ?? msg?.mentionEveryone;
        const roles = msg?.mention_roles ?? msg?.mentionRoles;
        const hasRoleMention = Array.isArray(roles) && roles.length > 0;
        if ((everyone || hasRoleMention) && selfId && !isDirectlyMentioned(msg, selfId)) {
            return true;
        }
    }

    if (settings.store.ignoreMutedServers) {
        const channelId = msg?.channel_id ?? msg?.channelId;
        if (channelId) {
            const channel: any = ChannelStore.getChannel(channelId);
            const guildId = channel?.guild_id;
            if (guildId && UserGuildSettingsStore?.isMuted?.(guildId)) return true;
        }
    }

    return false;
}

function getDisplayMessages(tabId: number, _guildFilter?: string): any[] {
    const cfg = TABS.find(t => t.id === tabId);
    if (!cfg) return [];

    let records: any[];
    if (cfg.kinds === null) {
        records = activityLog.map(e => e.record);
    } else {
        const allowed = new Set(cfg.kinds);
        records = activityLog.filter(e => allowed.has(e.kind)).map(e => e.record);
    }

    if (cfg.includeDiscordMentions && settings.store.includeDiscordMentions) {
        try {
            const native: any[] = RecentMentionsStore?.getMentions?.() ?? [];
            if (Array.isArray(native) && native.length) records = [...records, ...native];
        } catch (err) {
            console.error("[BetterInbox] RecentMentionsStore.getMentions failed", err);
        }
    }

    records = records.filter(r => !shouldDropForFilters(r));
    records.sort((a, b) => recordTimestamp(b) - recordTimestamp(a));
    return records;
}

// =================== Capture handlers ===================

function isReplyToMe(message: any, selfId: string): boolean {
    const ref = message.message_reference ?? message.messageReference;
    if (!ref?.message_id) return false;
    const refMsg = message.referenced_message ?? message.referencedMessage;
    let originalAuthorId: string | undefined = refMsg?.author?.id;
    if (!originalAuthorId) {
        const stored: any = MessageStore.getMessage(ref.channel_id ?? message.channel_id, ref.message_id);
        originalAuthorId = stored?.author?.id;
    }
    return originalAuthorId === selfId;
}

function mentionsUser(message: any, userId: string): boolean {
    const mentions: any[] = message.mentions ?? [];
    return mentions.some(m => (typeof m === "string" ? m : m?.id) === userId);
}

function handleSilentReply(message: any, selfId: string): boolean {
    if (!settings.store.includeReplies) return false;
    if (settings.store.ignoreSelf && message.author?.id === selfId) return false;
    if (settings.store.ignoreBots && message.author?.bot) return false;
    if (!isReplyToMe(message, selfId)) return false;
    if (mentionsUser(message, selfId)) return false;
    pushEntry("reply", "reply:" + message.id, message);
    return true;
}

function handleForumReply(message: any, selfId: string): boolean {
    if (!settings.store.includeForumReplies) return false;
    if (message.author?.id === selfId) return false;
    if (settings.store.ignoreBots && message.author?.bot) return false;
    const channel: any = ChannelStore.getChannel(message.channel_id);
    if (!channel) return false;
    if (channel.type !== 10 && channel.type !== 11 && channel.type !== 12) return false;
    if (channel.ownerId !== selfId && channel.owner_id !== selfId) return false;
    pushEntry("forum-reply", "forum:" + message.id, message, { threadOrForumName: channel.name });
    return true;
}

function handlePinSystemMessage(message: any, selfId: string): boolean {
    if (!settings.store.includePins) return false;
    if (message.type !== 6) return false;
    const ref = message.message_reference;
    if (!ref?.message_id) return false;
    const pinned: any = MessageStore.getMessage(ref.channel_id ?? message.channel_id, ref.message_id);
    if (!pinned) return false;
    if (pinned.author?.id !== selfId) return false;
    pushEntry("pinned", "pin:" + message.id, message, {
        pinnedContent: pinned.content ?? "",
        pinnerName: message.author?.global_name ?? message.author?.username ?? ""
    });
    return true;
}

function handleBlockedMention(message: any, selfId: string): boolean {
    if (!settings.store.includeBlockedMentions) return false;
    if (!message.author?.id) return false;
    if (!RelationshipStore.isBlocked(message.author.id)) return false;
    if (!mentionsUser(message, selfId)) return false;
    pushEntry("blocked-mention", "blocked:" + message.id, message);
    return true;
}

function handleMentionEdit(message: any, selfId: string): boolean {
    if (!settings.store.includeMentionEdits) return false;
    const editedTs = message?.edited_timestamp ?? message?.editedTimestamp;
    if (!editedTs) return false;
    if (message.author?.id === selfId) return false;
    if (settings.store.ignoreBots && message.author?.bot) return false;
    if (!mentionsUser(message, selfId)) return false;
    pushEntry("mention-edit", `edit:${message.id}:${editedTs}`, message);
    return true;
}

interface ReactionAddPayload {
    channelId: string;
    messageId: string;
    messageAuthorId: string;
    userId: string;
    emoji: ReactionEmoji;
    optimistic?: boolean;
    type: string;
}

function handleReactionAdd(e: ReactionAddPayload) {
    if (!settings.store.includeReactions) return;
    if (e.optimistic) return;
    const selfId = getCurrentUserId();
    if (!selfId) return;
    if (e.messageAuthorId !== selfId) return;
    if (settings.store.ignoreSelf && e.userId === selfId) return;
    const reactingUser: User | undefined = UserStore.getUser(e.userId);
    if (settings.store.ignoreBots && reactingUser?.bot) return;
    const original: any = MessageStore.getMessage(e.channelId, e.messageId);
    const originalContent = original?.content ?? "";

    const synthetic = makeSyntheticRaw({
        id: `reaction:${e.messageId}:${e.userId}:${e.emoji?.id ?? e.emoji?.name ?? ""}`,
        channelId: e.channelId,
        author: userToJson(reactingUser, e.userId),
        content: "",
        referenceChannelId: e.channelId,
        referenceMessageId: e.messageId
    });
    pushEntry("reaction", synthetic.id, synthetic, { emoji: e.emoji, originalContent });
}

function handleThreadCreated(event: any) {
    if (!settings.store.includeThreadCreations) return;
    const thread = event?.thread;
    if (!thread) return;
    const newlyCreated = event.newlyCreated ?? event.newly_created ?? thread.newlyCreated ?? thread.newly_created;
    if (!newlyCreated) return;
    const selfId = getCurrentUserId();
    if (!selfId) return;
    const parentChannelId = thread.parent_id ?? thread.parentId;
    if (!parentChannelId) return;
    const originalMessage: any = MessageStore.getMessage(parentChannelId, thread.id);
    if (!originalMessage) return;
    if (originalMessage.author?.id !== selfId) return;
    const ownerId = thread.owner_id ?? thread.ownerId;
    if (settings.store.ignoreSelf && ownerId === selfId) return;
    const creator = ownerId ? UserStore.getUser(ownerId) : undefined;
    if (settings.store.ignoreBots && creator?.bot) return;

    const synthetic = makeSyntheticRaw({
        id: "thread:" + thread.id,
        channelId: parentChannelId,
        author: userToJson(creator, ownerId ?? "0"),
        content: "",
        referenceChannelId: parentChannelId,
        referenceMessageId: thread.id
    });
    pushEntry("thread-created", "thread:" + thread.id, synthetic, {
        threadName: thread.name ?? "",
        threadId: thread.id,
        originalContent: originalMessage.content ?? ""
    });
}

function handleGroupDmAdd(channel: any) {
    if (!settings.store.includeGroupDmAdds) return;
    if (!channel) return;
    if (channel.type !== 3) return;
    const selfId = getCurrentUserId();
    if (!selfId) return;
    const ownerId = channel.owner_id ?? channel.ownerId;
    if (ownerId === selfId) return;
    const owner = ownerId ? UserStore.getUser(ownerId) : undefined;
    const groupName = channel.name && channel.name.length > 0 ? channel.name : "Group DM";

    const synthetic = makeSyntheticRaw({
        id: "group:" + channel.id,
        channelId: channel.id,
        author: userToJson(owner, ownerId ?? "0"),
        content: "",
        referenceChannelId: channel.id,
        referenceMessageId: channel.id
    });
    pushEntry("group-add", "group:" + channel.id, synthetic, { groupName });
}

function handleRelationshipAdd(event: any) {
    const rel = event?.relationship;
    if (!rel) return;
    const selfId = getCurrentUserId();
    if (!selfId) return;
    const userId: string = rel.id ?? rel.user?.id;
    if (!userId || userId === selfId) return;
    const user = rel.user ?? UserStore.getUser(userId);
    const displayName = user?.global_name ?? user?.globalName ?? user?.username ?? userId;

    if (rel.type === 3 && settings.store.includeFriendRequests) {
        const synthetic = makeSyntheticRaw({
            id: "fr:" + userId,
            channelId: userId,
            author: userToJson(user, userId),
            content: ""
        });
        pushEntry("friend-request", "fr:" + userId, synthetic, { friendName: displayName });
    } else if (rel.type === 1 && settings.store.includeFriendAdded) {
        const id = "fa:" + userId;
        const synthetic = makeSyntheticRaw({
            id,
            channelId: userId,
            author: userToJson(user, userId),
            content: ""
        });
        pushEntry("friend-added", id, synthetic, { friendName: displayName });
    }
}

function handleScheduledEventCreate(event: any) {
    if (!settings.store.includeScheduledEvents) return;
    const evt = event?.guildScheduledEvent ?? event?.guild_scheduled_event;
    if (!evt) return;
    const guildId = evt.guild_id ?? evt.guildId;
    const guild = guildId ? GuildStore.getGuild(guildId) : undefined;
    const creatorId = evt.creator_id ?? evt.creatorId;
    const creator = creatorId ? UserStore.getUser(creatorId) : undefined;
    const channelForRef = evt.channel_id ?? evt.channelId ?? guild?.systemChannelId ?? guildId ?? "0";

    const synthetic = makeSyntheticRaw({
        id: "evt:" + evt.id,
        channelId: channelForRef,
        author: userToJson(creator, creatorId ?? "0"),
        content: "",
        referenceGuildId: guildId
    });
    pushEntry("scheduled-event", "evt:" + evt.id, synthetic, {
        eventName: evt.name ?? "",
        eventGuildName: guild?.name ?? "",
        eventStartTime: evt.scheduled_start_time ?? evt.scheduledStartTime ?? ""
    });
}

function processMessageCreate(message: any) {
    if (!message) return;
    const selfId = getCurrentUserId();
    if (!selfId) return;
    if (message.type === 6) { handlePinSystemMessage(message, selfId); return; }
    if (handleSilentReply(message, selfId)) return;
    if (handleBlockedMention(message, selfId)) return;
    if (handleForumReply(message, selfId)) return;
}

function processMessageUpdate(message: any) {
    if (!message) return;
    const selfId = getCurrentUserId();
    if (!selfId) return;
    handleMentionEdit(message, selfId);
}

// =================== Rendering ===================

function KindBadge({ kind, meta }: { kind: ActivityKind; meta?: ActivityMeta; }) {
    const labels: Record<ActivityKind, string> = {
        "reply": "REPLY",
        "reaction": "REACTION",
        "forum-reply": "IN YOUR THREAD",
        "thread-created": "THREAD STARTED",
        "pinned": "PINNED",
        "group-add": "GROUP INVITE",
        "blocked-mention": "BLOCKED",
        "mention-edit": "EDITED",
        "friend-request": "FRIEND REQUEST",
        "friend-added": "NEW FRIEND",
        "scheduled-event": "EVENT"
    };
    const label = labels[kind] ?? kind.toUpperCase();
    let detail: string = label;
    if (kind === "forum-reply" && meta?.threadOrForumName) detail = `${label} · ${meta.threadOrForumName}`;
    if (kind === "scheduled-event" && meta?.eventGuildName) detail = `${label} · ${meta.eventGuildName}`;
    return <span className={classes(cl("kind-badge"), cl(`kind-${kind}`))}>{detail}</span>;
}

function renderSyntheticContent(kind: ActivityKind, meta?: ActivityMeta) {
    if (kind === "reaction") {
        const emoji = meta?.emoji;
        const original = shortenContent(meta?.originalContent ?? "");
        const emojiNode = emoji?.id
            ? <img
                src={`https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? "gif" : "webp"}?size=24&quality=lossless`}
                alt={emoji.name}
                className={cl("reaction-emoji")}
            />
            : <span>{emoji?.name ?? "❓"}</span>;
        return (
            <>
                <span className={cl("synth-line")}>reacted with {emojiNode}</span>
                {original && <span className={cl("reply-quote")}>{original}</span>}
            </>
        );
    }
    if (kind === "thread-created") {
        return (
            <>
                <span className={cl("synth-line")}>started a thread: <strong>{meta?.threadName ?? "(unnamed)"}</strong></span>
                {meta?.originalContent && <span className={cl("reply-quote")}>{shortenContent(meta.originalContent)}</span>}
            </>
        );
    }
    if (kind === "pinned") {
        return (
            <>
                <span className={cl("synth-line")}>pinned your message</span>
                {meta?.pinnedContent && <span className={cl("reply-quote")}>{shortenContent(meta.pinnedContent)}</span>}
            </>
        );
    }
    if (kind === "group-add") {
        return <span className={cl("synth-line")}>added you to <strong>{meta?.groupName ?? "a group DM"}</strong></span>;
    }
    if (kind === "friend-request") {
        return <span className={cl("synth-line")}>sent you a friend request</span>;
    }
    if (kind === "friend-added") {
        return <span className={cl("synth-line")}>is now your friend</span>;
    }
    if (kind === "scheduled-event") {
        const when = meta?.eventStartTime ? new Date(meta.eventStartTime).toLocaleString() : "";
        return (
            <>
                <span className={cl("synth-line")}>scheduled an event: <strong>{meta?.eventName ?? "(untitled)"}</strong></span>
                {when && <span className={cl("reply-quote")}>starts {when}</span>}
            </>
        );
    }
    return null;
}

function syncHideNatives() {
    if (!settings.store.hideNativeTabs) {
        disableStyle(hideNativesStyle);
        return;
    }
    // Push the runtime-resolved inbox tab class into the managed stylesheet's
    // [--tab] placeholder. setStyleClassNames recompiles automatically if enabled.
    const tab = tabClass?.tab;
    setStyleClassNames(hideNativesStyle, tab ? { tab } : {});
    enableStyle(hideNativesStyle);
}

function openEntryContextMenu(event: React.MouseEvent, msg: any, owning?: StoredEntry) {
    event.preventDefault();
    event.stopPropagation();

    const channelId = msg?.channel_id;
    const channel = channelId ? ChannelStore.getChannel(channelId) : null;

    ContextMenuApi.openContextMenu(event, () => (
        <Menu.Menu
            navId="vc-betterinbox-entry"
            onClose={ContextMenuApi.closeContextMenu}
            aria-label="Inbox Entry Options"
        >
            <Menu.MenuItem
                id="vc-bi-mark-read"
                label="Mark as Read"
                disabled={!channel}
                action={() => {
                    if (channel) {
                        try { ReadStateUtils.ackChannel(channel); }
                        catch (err) { console.error("[BetterInbox] ackChannel failed", err); }
                    }
                    if (owning) markEntryRead(owning.id, false);
                }}
            />
            {owning && (
                <Menu.MenuItem
                    id="vc-bi-delete"
                    label="Delete"
                    color="danger"
                    action={() => deleteEntry(owning.id)}
                />
            )}
        </Menu.Menu>
    ));
}

function DoubleCheckmarkIcon() {
    return (
        <svg width={16} height={16} viewBox="0 0 24 24" role="img">
            <path fill="currentColor"
                d="M16.7 8.7a1 1 0 0 0-1.4-1.4l-3.26 3.24a1 1 0 0 0 1.42 1.42L16.7 8.7ZM3.7 11.3a1 1 0 0 0-1.4 1.4l4.5 4.5a1 1 0 0 0 1.4-1.4l-4.5-4.5Z" />
            <path fill="currentColor"
                d="M21.7 9.7a1 1 0 0 0-1.4-1.4L13 15.58l-3.3-3.3a1 1 0 0 0-1.4 1.42l4 4a1 1 0 0 0 1.4 0l8-8Z" />
        </svg>
    );
}

// =================== Plugin ===================

export default definePlugin({
    name: "BetterInbox",
    description: "Replaces Discord's inbox with a single 'Activity' tab that captures replies, reactions, threads, pins, edits, blocked mentions, group invites, friend requests, scheduled events, and Discord's native @-mentions. Each capture type is toggleable.",
    authors: [EquicordDevs.ELJoOker],
    tags: ["Notifications", "Chat"],
    settings,

    patches: [
        // Inject our Activity tab + clear button + content into Discord's inbox popout.
        // No `group: true` — if any one of these fails, the others should still apply.
        {
            find: "#{intl::UNREADS_TAB_LABEL})}",
            replacement: [
                // 1. Append our 4 tab buttons right after the Unreads native tab.
                {
                    match: /#{intl::Fn6Odn::raw}\)\}\):null/,
                    replace: "$&,$self.renderTab(9),$self.renderTab(10),$self.renderTab(11),$self.renderTab(12)"
                },
                // 2. Inject our clear button before the MENTIONS tab's slot for any of our tabs.
                {
                    match: /:(\i)===\i\.\i\.MENTIONS\?\(0,.{0,500}null}/,
                    replace: `: ($1 >= ${MIN_TAB_ID} && $1 <= ${MAX_TAB_ID}) ? $self.renderClearButton($1) $&`
                },
                // 3. Inject our content renderer for any of our tabs.
                {
                    match: /:(\i)===\i\.\i\.MENTIONS\?\(0,.{0,500}onJump:(\i)}\)/,
                    replace: `: ($1 >= ${MIN_TAB_ID} && $1 <= ${MAX_TAB_ID}) ? $self.renderContent($1, $2) $&`
                }
            ]
        },
        // Native-tab hiding uses a managed stylesheet (hideNatives.css) toggled via
        // the @api/Styles enableStyle/disableStyle API — no raw DOM manipulation.
        // The patch-based approach kept producing parse errors because the bundle's
        // exact JSX shape for the inbox tabs varies; managed CSS is robust to that
        // and is the sanctioned Equicord way to handle dynamic class resolution.
        // Capture Discord's mention-row renderer + route the row's X-button through our deleteEntry for our entries.
        {
            find: ".guildFilter:null",
            replacement: [
                {
                    match: /function (\i)\(\i\){let{message:\i,gotoMessage/,
                    replace: "$self.renderInboxMsg = $1; $&"
                },
                {
                    match: /onClick:\(\)=>(\i\.\i\.deleteRecentMention\((\i)\.id\))/,
                    replace: "onClick: () => $2._betterInbox ? $self.deleteEntry($2._betterInbox.id) : $1"
                }
            ]
        }
    ],

    shouldHideNatives() {
        return !!settings.store.hideNativeTabs;
    },

    renderTab(id: number) {
        // Re-sync each render so toggling hideNativeTabs / unread badge propagates
        // without needing a Discord reload.
        syncHideNatives();
        syncUnreadBadge();

        const cfg = TABS.find(t => t.id === id);
        if (!cfg) return null;
        if (!settings.store[cfg.settingKey]) return null;

        return (
            <TabBar.Item key={id} className={classes(tabClass.tab, OUR_TAB_MARKER_CLASS)} id={id}>
                {cfg.label}
            </TabBar.Item>
        );
    },

    renderClearButton(tabId: number) {
        const cfg = TABS.find(t => t.id === tabId);
        const tooltipText = !cfg || cfg.kinds === null ? "Clear All" : `Clear ${cfg.label}`;
        return (
            <Tooltip text={tooltipText}>
                {({ onMouseLeave, onMouseEnter }) => (
                    <Button
                        variant="secondary"
                        size="iconOnly"
                        onMouseLeave={onMouseLeave}
                        onMouseEnter={onMouseEnter}
                        onClick={() => clearTab(tabId)}>
                        <DoubleCheckmarkIcon />
                    </Button>
                )}
            </Tooltip>
        );
    },

    // Captured at runtime via patch (#2).
    renderInboxMsg(_: any) { return null; },

    renderContent(tabId: number, onJump: any) {
        const channel = ChannelStore.getChannel(SelectedChannelStore.getChannelId());

        // Force re-render counter — flipped when activityLog changes externally
        // (capture handlers, native mention dispatches, etc.).
        const [, forceUpdate] = useState(0);
        onLogChange = () => forceUpdate(n => n + 1);

        // Recompute every render so tab switches (different tabId) immediately
        // show the right content. Cheap relative to Discord's render cost.
        const snapshot = getDisplayMessages(tabId);

        // When the user views any of our tabs, mark every captured entry as read.
        // This makes the inbox-icon red dot disappear when there's nothing new.
        // The dependency on tabId means it re-runs on each tab switch too — harmless,
        // since markAllRead is a no-op when nothing is unread.
        useEffect(() => {
            if (markAllRead()) forceUpdate(n => n + 1);
        }, [tabId]);

        const messageRender = (msg: any, jump: any) => {
            const owning = activityLog.find(e => e.record === msg);
            if (owning) {
                msg._betterInbox = { id: owning.id };
            }

            const kind: ActivityKind | undefined = owning?.kind ?? msg._betterInboxKind;
            const meta: ActivityMeta | undefined = owning?.meta ?? msg._betterInboxMeta;

            const syntheticKinds: ReadonlySet<ActivityKind> = new Set<ActivityKind>([
                "reaction", "thread-created", "pinned", "group-add",
                "friend-request", "friend-added", "scheduled-event"
            ]);
            if (kind && syntheticKinds.has(kind)) {
                const body = renderSyntheticContent(kind, meta);
                if (body) msg.customRenderedContent = { content: body };
            }

            const rendered = this.renderInboxMsg({
                message: msg,
                gotoMessage: () => {
                    if (owning) markEntryRead(owning.id, false);
                    jump?.(msg.channel_id, msg.id, msg);
                },
                dismissible: true
            });

            return [
                <div
                    className={classes(cl("entry"), kind ? cl(`entry-${kind}`) : "")}
                    onContextMenu={(e: React.MouseEvent) => openEntryContextMenu(e, msg, owning)}
                >
                    {kind && (
                        <div className={cl("entry-header")}>
                            <KindBadge kind={kind} meta={meta} />
                        </div>
                    )}
                    {rendered}
                </div>
            ];
        };

        return (
            <Popout
                className={classes(recentMentionsPopoutClass.recentMentionsPopout)}
                scrollerClassName={classes(recentMentionsPopoutClass.scroller)}
                renderHeader={() => null}
                renderMessage={messageRender}
                channel={channel}
                onJump={onJump}
                onFetch={() => null}
                onCloseMessage={(id: string) => {
                    const entry = activityLog.find(e => e.record?.id === id);
                    if (entry) deleteEntry(entry.id);
                }}
                loadMore={() => null}
                messages={snapshot}
                renderEmptyState={() => null}
                canCloseAllMessages={true}
            />
        );
    },

    deleteEntry,

    async start() {
        const raw: any[] = (await DataStore.get(LOG_KEY)) ?? [];
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
        syncUnreadBadge();

        interceptor = (e: any) => {
            try {
                switch (e.type) {
                    case "MESSAGE_CREATE": processMessageCreate(e.message); break;
                    case "MESSAGE_UPDATE": processMessageUpdate(e.message); break;
                    case "MESSAGE_REACTION_ADD": handleReactionAdd(e); break;
                    case "THREAD_CREATE": handleThreadCreated(e); break;
                    case "CHANNEL_CREATE": handleGroupDmAdd(e.channel); break;
                    case "RELATIONSHIP_ADD": handleRelationshipAdd(e); break;
                    case "GUILD_SCHEDULED_EVENT_CREATE": handleScheduledEventCreate(e); break;
                    case "LOAD_RECENT_MENTIONS_SUCCESS":
                    case "RECENT_MENTION_DELETE":
                        onLogChange();
                        break;
                }
            } catch (err) {
                console.error("[BetterInbox] interceptor error", err);
            }
            return false;
        };
        FluxDispatcher.addInterceptor(interceptor as any);

        syncHideNatives();
        syncUnreadBadge();
    },

    stop() {
        if (interceptor) {
            const list = (FluxDispatcher as any)._interceptors;
            if (Array.isArray(list)) {
                const idx = list.indexOf(interceptor);
                if (idx > -1) list.splice(idx, 1);
            }
            interceptor = null;
        }
        disableStyle(hideNativesStyle);
        disableStyle(unreadBadgeStyle);
    }
});
