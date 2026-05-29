/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { setStyleClassNames } from "@api/Styles";
import { Button } from "@components/Button";
import ErrorBoundary from "@components/ErrorBoundary";
import { EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { Logger } from "@utils/Logger";
import { classes } from "@utils/misc";
import { useForceUpdater } from "@utils/react";
import definePlugin from "@utils/types";
import { findByCodeLazy, findCssClassesLazy } from "@webpack";
import { ChannelStore, ContextMenuApi, GuildStore, IconUtils, Menu, MessageStore, ReadStateUtils, SelectedChannelStore, TabBar, Tooltip, useEffect, UserStore } from "@webpack/common";

import hideNativesStyle from "./hideNatives.css?managed";
import { settings } from "./settings";
import {
    ActivityKind,
    ActivityMeta,
    ChannelCreatePayload,
    InboxRecord,
    MessagePayload,
    ReactionAddPayload,
    RelationshipAddPayload,
    ScheduledEventCreatePayload,
    StoredEntry,
    ThreadCreatePayload
} from "./types";
import {
    clearTab,
    deleteEntry,
    getActivityLog,
    getDisplayMessages,
    loadActivityLog,
    logSubscribers,
    makeSyntheticRaw,
    markAllRead,
    markEntryRead,
    notifyLogChange,
    processMessageCreate,
    processMessageUpdate,
    pushEntry,
    shortenContent,
    TABS,
    userMessagedChannelIds,
    userToJson
} from "./utils";

const logger = new Logger("BetterInbox");
const cl = classNameFactory("vc-betterinbox-");

const MIN_TAB_ID = 9;
const MAX_TAB_ID = 12;
const OUR_TAB_MARKER_CLASS = "vc-betterinbox-our-tab";

const tabClass = findCssClassesLazy("inboxTitle", "tab");
const recentMentionsPopoutClass = findCssClassesLazy("recentMentionsPopout", "scroller");
const Popout = findByCodeLazy("getProTip", "canCloseAllMessages:");

const SYNTHETIC_KINDS = new Set<ActivityKind>([
    "reaction", "thread-created", "pinned", "group-add",
    "friend-request", "friend-added", "scheduled-event"
]);

type JumpFn = (channelId: string, messageId: string, message: InboxRecord) => void;

interface InboxMsgProps {
    message: InboxRecord;
    gotoMessage: () => void;
    dismissible: boolean;
}

function syncHideNatives() {
    setStyleClassNames(hideNativesStyle, settings.store.hideNativeTabs
        ? { tab: tabClass.tab, popout: recentMentionsPopoutClass.recentMentionsPopout }
        : {});
}

function renderSyntheticContent(kind: ActivityKind, meta?: ActivityMeta) {
    if (kind === "reaction") {
        const emoji = meta?.emoji;
        const original = shortenContent(meta?.originalContent ?? "");
        const emojiNode = emoji?.id
            ? <img
                src={IconUtils.getEmojiURL({ id: emoji.id, animated: !!emoji.animated, size: 24 })}
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

function openEntryContextMenu(event: React.MouseEvent, msg: InboxRecord, owning?: StoredEntry) {
    event.preventDefault();
    event.stopPropagation();

    const channel = msg.channel_id ? ChannelStore.getChannel(msg.channel_id) : null;

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
                        catch (err) { logger.error("ackChannel failed", err); }
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

interface BetterInboxContentProps {
    tabId: number;
    onJump: JumpFn;
    renderInboxMsg: (props: InboxMsgProps) => React.ReactNode;
}

function BetterInboxContent({ tabId, onJump, renderInboxMsg }: BetterInboxContentProps) {
    const channel = ChannelStore.getChannel(SelectedChannelStore.getChannelId());
    const forceUpdate = useForceUpdater();

    useEffect(() => {
        syncHideNatives();
    }, []);

    useEffect(() => {
        logSubscribers.add(forceUpdate);
        return () => { logSubscribers.delete(forceUpdate); };
    }, [forceUpdate]);

    useEffect(() => {
        if (markAllRead()) forceUpdate();
    }, [tabId, forceUpdate]);

    const snapshot = getDisplayMessages(tabId);

    const messageRender = (msg: InboxRecord, jump?: JumpFn) => {
        const owning = getActivityLog().find(e => e.record === msg);
        if (owning) msg._betterInbox = { id: owning.id };

        const kind = owning?.kind ?? msg._betterInboxKind;
        const meta = owning?.meta ?? msg._betterInboxMeta;

        if (kind && SYNTHETIC_KINDS.has(kind)) {
            const body = renderSyntheticContent(kind, meta);
            if (body) msg.customRenderedContent = { content: body };
        }

        const rendered = renderInboxMsg({
            message: msg,
            gotoMessage: () => {
                if (owning) markEntryRead(owning.id, false);
                jump?.(msg.channel_id, msg.id, msg);
            },
            dismissible: true
        });

        return [
            <div
                key={msg.id}
                className={classes(cl("entry"), kind ? cl(`entry-${kind}`) : "")}
                onContextMenu={(e: React.MouseEvent) => openEntryContextMenu(e, msg, owning)}
            >
                {rendered}
            </div>
        ];
    };

    return (
        <Popout
            key={tabId}
            className={classes(recentMentionsPopoutClass.recentMentionsPopout)}
            scrollerClassName={classes(recentMentionsPopoutClass.scroller)}
            renderHeader={() => null}
            renderMessage={messageRender}
            channel={channel}
            onJump={onJump}
            onFetch={() => null}
            onCloseMessage={(id: string) => {
                const entry = getActivityLog().find(e => e.record.id === id);
                if (entry) deleteEntry(entry.id);
            }}
            loadMore={() => null}
            messages={snapshot}
            renderEmptyState={() => null}
            canCloseAllMessages={true}
        />
    );
}

const WrappedBetterInboxContent = ErrorBoundary.wrap(BetterInboxContent, { noop: true });

function ClearButtonBase({ tabId }: { tabId: number; }) {
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
}

const ClearButton = ErrorBoundary.wrap(ClearButtonBase, { noop: true });

export default definePlugin({
    name: "BetterInbox",
    description: "Replaces Discord's inbox with multiple tabs that capture replies, reactions, threads, pins, edits, blocked mentions, group invites, friend requests, scheduled events, and Discord's native @-mentions. Each capture type is toggleable.",
    authors: [EquicordDevs.ELJoOker],
    tags: ["Notifications", "Chat"],
    settings,
    managedStyle: hideNativesStyle,

    patches: [
        {
            find: "#{intl::UNREADS_TAB_LABEL})}",
            replacement: [
                {
                    match: /#{intl::Fn6Odn::raw}\)\}\):null/,
                    replace: "$&,$self.renderTab(9),$self.renderTab(10),$self.renderTab(11),$self.renderTab(12)"
                },
                {
                    match: /:(\i)===\i\.\i\.MENTIONS\?\(0,.{0,500}null}/,
                    replace: `: ($1 >= ${MIN_TAB_ID} && $1 <= ${MAX_TAB_ID}) ? $self.renderClearButton($1) $&`
                },
                {
                    match: /:(\i)===\i\.\i\.MENTIONS\?\(0,.{0,500}onJump:(\i)}\)/,
                    replace: `: ($1 >= ${MIN_TAB_ID} && $1 <= ${MAX_TAB_ID}) ? $self.renderContent($1, $2) $&`
                }
            ]
        },
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

    flux: {
        MESSAGE_CREATE(payload: MessagePayload) {
            const selfId = UserStore.getCurrentUser()?.id;
            const msg = payload.message;
            if (selfId && msg?.author?.id === selfId && msg.channel_id) {
                userMessagedChannelIds.add(msg.channel_id);
            }
            processMessageCreate(msg);
        },
        MESSAGE_UPDATE(payload: MessagePayload) {
            processMessageUpdate(payload.message);
        },
        MESSAGE_REACTION_ADD(payload: ReactionAddPayload) {
            if (!settings.store.includeReactions || payload.optimistic) return;
            const selfId = UserStore.getCurrentUser()?.id;
            if (!selfId || payload.messageAuthorId !== selfId) return;
            if (settings.store.ignoreSelf && payload.userId === selfId) return;
            const reactingUser = UserStore.getUser(payload.userId);
            if (settings.store.ignoreBots && reactingUser?.bot) return;
            const original = MessageStore.getMessage(payload.channelId, payload.messageId);

            const synthetic = makeSyntheticRaw({
                id: `reaction:${payload.messageId}:${payload.userId}:${payload.emoji?.id ?? payload.emoji?.name ?? ""}`,
                channelId: payload.channelId,
                author: userToJson(reactingUser, payload.userId),
                content: "",
                referenceChannelId: payload.channelId,
                referenceMessageId: payload.messageId
            });
            pushEntry("reaction", synthetic.id, synthetic, { emoji: payload.emoji, originalContent: original?.content ?? "" });
        },
        THREAD_CREATE(event: ThreadCreatePayload) {
            if (!settings.store.includeThreadCreations) return;
            const { thread } = event;
            if (!thread) return;
            const newlyCreated = event.newlyCreated ?? event.newly_created ?? thread.newlyCreated ?? thread.newly_created;
            const selfId = UserStore.getCurrentUser()?.id;
            const parentChannelId = thread.parent_id ?? thread.parentId;
            if (!newlyCreated || !selfId || !parentChannelId) return;
            const originalMessage = MessageStore.getMessage(parentChannelId, thread.id);
            if (originalMessage?.author.id !== selfId) return;
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
                originalContent: originalMessage.content
            });
        },
        CHANNEL_CREATE(payload: ChannelCreatePayload) {
            if (!settings.store.includeGroupDmAdds) return;
            const { channel } = payload;
            if (channel?.type !== 3) return;
            const selfId = UserStore.getCurrentUser()?.id;
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
        },
        RELATIONSHIP_ADD(event: RelationshipAddPayload) {
            const { relationship } = event;
            if (!relationship) return;
            const selfId = UserStore.getCurrentUser()?.id;
            const userId = relationship.id ?? relationship.user?.id;
            if (!selfId || !userId || userId === selfId) return;
            const author = userToJson(relationship.user ?? UserStore.getUser(userId), userId);
            const friendName = author.global_name ?? author.username ?? userId;

            if (relationship.type === 3 && settings.store.includeFriendRequests) {
                const synthetic = makeSyntheticRaw({ id: "fr:" + userId, channelId: userId, author, content: "" });
                pushEntry("friend-request", "fr:" + userId, synthetic, { friendName });
            } else if (relationship.type === 1 && settings.store.includeFriendAdded) {
                const synthetic = makeSyntheticRaw({ id: "fa:" + userId, channelId: userId, author, content: "" });
                pushEntry("friend-added", "fa:" + userId, synthetic, { friendName });
            }
        },
        GUILD_SCHEDULED_EVENT_CREATE(event: ScheduledEventCreatePayload) {
            if (!settings.store.includeScheduledEvents) return;
            const evt = event.guildScheduledEvent ?? event.guild_scheduled_event;
            if (!evt) return;
            const guildId = evt.guild_id ?? evt.guildId;
            const guild = guildId ? GuildStore.getGuild(guildId) : undefined;
            const creatorId = evt.creator_id ?? evt.creatorId;
            const creator = creatorId ? UserStore.getUser(creatorId) : undefined;

            const synthetic = makeSyntheticRaw({
                id: "evt:" + evt.id,
                channelId: evt.channel_id ?? evt.channelId ?? guild?.systemChannelId ?? guildId ?? "0",
                author: userToJson(creator, creatorId ?? "0"),
                content: "",
                referenceGuildId: guildId
            });
            pushEntry("scheduled-event", "evt:" + evt.id, synthetic, {
                eventName: evt.name ?? "",
                eventGuildName: guild?.name ?? "",
                eventStartTime: evt.scheduled_start_time ?? evt.scheduledStartTime ?? ""
            });
        },
        LOAD_RECENT_MENTIONS_SUCCESS() { notifyLogChange(); },
        RECENT_MENTION_DELETE() { notifyLogChange(); }
    },

    renderTab(id: number) {
        const cfg = TABS.find(t => t.id === id);
        if (!cfg || !settings.store[cfg.settingKey]) return null;
        if (getDisplayMessages(id).length === 0) return null;
        return (
            <TabBar.Item key={id} className={classes(tabClass.tab, OUR_TAB_MARKER_CLASS)} id={id}>
                {cfg.label}
            </TabBar.Item>
        );
    },

    renderClearButton(tabId: number) {
        return <ClearButton tabId={tabId} />;
    },

    renderInboxMsg(_props: InboxMsgProps): React.ReactNode {
        return null;
    },

    renderContent(tabId: number, onJump: JumpFn) {
        return <WrappedBetterInboxContent tabId={tabId} onJump={onJump} renderInboxMsg={this.renderInboxMsg.bind(this)} />;
    },

    deleteEntry,

    async start() {
        await loadActivityLog();
        syncHideNatives();
    },

    stop() {
        logSubscribers.clear();
    }
});
