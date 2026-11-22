/*
 * Equicord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { Flex } from "@components/Flex";
import { InfoIcon } from "@components/Icons";
import { Text } from "@components/Text";
import { copyWithToast, openUserProfile } from "@utils/discord";
import { LazyComponent } from "@utils/react";
import { Channel, RenderModalProps, type User } from "@vencord/discord-types";
import { find, findByCodeLazy } from "@webpack";
import { Alerts, ChannelStore, closeAllModals, ContextMenuApi, FluxDispatcher, GuildStore, Menu, Modal, NavigationRouter, openModal, React, TabBar, TextInput, Tooltip, UserStore, useMemo, useRef, useState } from "@webpack/common";

import { DBMessageRecord, deleteMessageIDB, deleteMessagesBulkIDB } from "../db";
import { cl, clearLogs, settings } from "../index";
import { LoggedMessage, LoggedMessageJSON } from "../types";
import { messageJsonToMessageClass } from "../utils";
import { importLogs } from "../utils/settingsUtils";
import { useMessages } from "./hooks";

export interface MessagePreviewProps {
    className: string;
    author: User;
    message: LoggedMessage;
    channel: Channel,
    compact: boolean;
    isGroupStart: boolean;
    hideSimpleEmbedContent: boolean;
}

const PrivateChannelRecord = findByCodeLazy(".is_message_request_timestamp,");
const MessagePreview = LazyComponent<MessagePreviewProps>(() => find(m => m?.type?.toString().includes("previewLinkTarget:") && !m?.type?.toString().includes("HAS_THREAD")));

export enum LogTabs {
    DELETED = "Deleted",
    EDITED = "Edited",
    GHOST_PING = "Ghost Pinged"
}

interface Props {
    modalProps: RenderModalProps;
    initalQuery?: string;
}

export function LogsModal({ modalProps, initalQuery }: Props) {
    const [currentTab, setCurrentTab] = useState(LogTabs.DELETED);
    const [queryEh, setQuery] = useState(initalQuery ?? "");
    const [sortNewest, setSortNewest] = useState(settings.store.sortNewest);
    const [numDisplayedMessages, setNumDisplayedMessages] = useState(settings.store.messagesToDisplayAtOnceInLogs);
    const contentRef = useRef<HTMLDivElement | null>(null);

    const { messages, total, statusTotal, pending, reset } = useMessages(queryEh, currentTab, sortNewest, numDisplayedMessages);

    return (
        <Modal
            {...modalProps}
            size="lg"
            title={
                <div className={cl("modal")}>
                    <TabBar
                        type="top"
                        look="brand"
                        className={cl("modal-tab-bar")}
                        selectedItem={currentTab}
                        onItemSelect={e => {
                            setCurrentTab(e);
                            setNumDisplayedMessages(settings.store.messagesToDisplayAtOnceInLogs);
                            contentRef.current?.firstElementChild?.scrollTo(0, 0);
                        }}
                    >
                        <TabBar.Item
                            className={cl("modal-tab-bar-item")}
                            id={LogTabs.DELETED}
                        >
                            Deleted
                        </TabBar.Item>
                        <TabBar.Item
                            className={cl("modal-tab-bar-item")}
                            id={LogTabs.EDITED}
                        >
                            Edited
                        </TabBar.Item>
                        <TabBar.Item
                            className={cl("modal-tab-bar-item")}
                            id={LogTabs.GHOST_PING}
                        >
                            Ghost Pinged
                        </TabBar.Item>
                    </TabBar>
                    <div className={cl("modal-filter")}>
                        <TextInput value={queryEh} onChange={e => setQuery(e)} placeholder="Filter Messages" />
                    </div>
                </div>
            }
            actions={[
                {
                    text: `Sort ${sortNewest ? "Oldest First" : "Newest First"}`,
                    variant: "secondary",
                    onClick: () => {
                        setSortNewest(e => {
                            const val = !e;
                            settings.store.sortNewest = val;
                            return val;
                        });
                        contentRef.current?.firstElementChild?.scrollTo(0, 0);
                    }
                },
                {
                    text: "Clear Visible Logs",
                    variant: "critical-secondary",
                    disabled: messages?.length === 0,
                    onClick: () => Alerts.show({
                        title: "Clear Logs",
                        body: `Are you sure you want to clear ${messages.length} logs`,
                        confirmText: "Clear",
                        confirmVariant: "critical-primary",
                        cancelText: "Cancel",
                        onConfirm: async () => {
                            await deleteMessagesBulkIDB(messages.map(e => e.message_id));
                            reset();
                        }
                    })
                },
                {
                    text: "Clear All Logs",
                    variant: "critical-primary",
                    onClick: () => Alerts.show({
                        title: "Clear Logs",
                        body: "Are you sure you want to clear all the logs",
                        confirmText: "Clear",
                        confirmVariant: "critical-primary",
                        cancelText: "Cancel",
                        onConfirm: async () => {
                            await clearLogs();
                            reset();
                        }
                    })
                }
            ]}
        >
            <div style={{ opacity: modalProps.transitionState === 1 ? "1" : "0" }} className={`${cl("modal-content-container")} ${cl("modal-root")}`} ref={contentRef}>
                {
                    modalProps.transitionState === 1 &&
                    <div>
                        {pending && (
                            <LoadingLogs tab={currentTab} />
                        )}

                        {!pending && messages != null && total === 0 && (
                            <EmptyLogs
                                hasQuery={queryEh.length !== 0}
                                reset={reset}
                            />
                        )}

                        {!pending && messages != null && total > 0 && (
                            <LogsContentMemo
                                visibleMessages={messages}
                                canLoadMore={messages.length < statusTotal && messages.length >= settings.store.messagesToDisplayAtOnceInLogs}
                                tab={currentTab}
                                sortNewest={sortNewest}
                                reset={reset}
                                handleLoadMore={() => setNumDisplayedMessages(e => e + settings.store.messagesToDisplayAtOnceInLogs)}
                            />
                        )}
                    </div>
                }
            </div>
        </Modal>
    );
}

/* ------------------------------------------------------------------ */
/* grouping                                                            */
/* ------------------------------------------------------------------ */

interface ChannelGroup {
    id: string;
    name: string;
    records: DBMessageRecord[];
}

interface LocationGroup {
    id: string;
    kind: "guild" | "dm";
    name: string;
    icon: string | null;
    count: number;
    /** timestamp of the group's first message in the current sort order */
    firstTimestamp: any;
    channels: ChannelGroup[];
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function dayKey(ts: any): string {
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? "unknown" : d.toDateString();
}

function formatDay(ts: any): string {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return "Unknown date";
    return d.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function formatRelative(ts: any): string {
    const t = new Date(ts).getTime();
    if (Number.isNaN(t)) return "";

    const seconds = Math.max(0, Math.floor((Date.now() - t) / 1000));
    if (seconds < 60) return "just now";

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;

    return new Date(t).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function dmName(channel: any): string {
    if (!channel) return "Unknown DM";
    if (channel.name) return channel.name;

    const names = (channel.recipients ?? [])
        .map((id: string) => UserStore.getUser(id))
        .filter(Boolean)
        .map((u: any) => u.globalName ?? u.username);

    return names.join(", ") || "Unknown DM";
}

function guildIconUrl(guild: any): string | null {
    if (!guild?.icon) return null;
    return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${guild.icon.startsWith("a_") ? "gif" : "png"}?size=64`;
}

/**
 * Servers first, then DMs. Inside each list, groups keep the order of their
 * first message, so the current sort order decides which group comes first.
 */
function groupRecords(records: DBMessageRecord[]): LocationGroup[] {
    const guilds = new Map<string, LocationGroup>();
    const dms = new Map<string, LocationGroup>();

    for (const record of records) {
        const m = record.message as any;
        const channelId: string = m.channel_id ?? m.channelId;
        const channel = ChannelStore.getChannel(channelId);
        const guildId: string | null = m.guildId ?? channel?.guild_id ?? null;

        if (!guildId) {
            let group = dms.get(channelId);
            if (!group) {
                const name = dmName(channel);
                group = { id: `c:${channelId}`, kind: "dm", name, icon: null, count: 0, firstTimestamp: m.timestamp, channels: [{ id: channelId, name, records: [] }] };
                dms.set(channelId, group);
            }
            group.count++;
            group.channels[0].records.push(record);
            continue;
        }

        let group = guilds.get(guildId);
        if (!group) {
            const guild = GuildStore.getGuild(guildId);
            group = { id: `g:${guildId}`, kind: "guild", name: guild?.name ?? "Unknown server", icon: guildIconUrl(guild), count: 0, firstTimestamp: m.timestamp, channels: [] };
            guilds.set(guildId, group);
        }

        let channelGroup = group.channels.find(c => c.id === channelId);
        if (!channelGroup) {
            channelGroup = { id: channelId, name: channel?.name ?? "unknown-channel", records: [] };
            group.channels.push(channelGroup);
        }

        group.count++;
        channelGroup.records.push(record);
    }

    return [...guilds.values(), ...dms.values()];
}

/* ------------------------------------------------------------------ */
/* list                                                                */
/* ------------------------------------------------------------------ */

interface LogContentProps {
    sortNewest: boolean;
    tab: LogTabs;
    visibleMessages: DBMessageRecord[];
    canLoadMore: boolean;
    reset: () => void;
    handleLoadMore: () => void;
}

function LogsContent({ visibleMessages, canLoadMore, sortNewest, tab, reset, handleLoadMore }: LogContentProps) {
    const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

    const groups = useMemo(() => groupRecords(visibleMessages), [visibleMessages]);

    if (visibleMessages.length === 0)
        return <NoResults tab={tab} />;

    const toggle = (id: string) => setCollapsed(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
    });

    // counts only cover what's loaded, so hide them until everything is loaded
    const showCounts = !canLoadMore;
    // the first message of a group is its newest (or oldest) one, depending on sort
    const timeLabel = sortNewest ? "Latest" : "Earliest";

    const renderMessages = (records: DBMessageRecord[]) => records.map(({ message }, i) => {
        const previous = records[i - 1]?.message;
        const newDay = !previous || dayKey(message.timestamp) !== dayKey(previous.timestamp);

        return (
            <React.Fragment key={message.id}>
                {newDay && <DayDivider timestamp={message.timestamp} />}
                <LMessage
                    log={{ message }}
                    reset={reset}
                    isGroupStart={newDay || isGroupStart(message, previous, sortNewest)}
                />
            </React.Fragment>
        );
    });

    return (
        <div className={cl("modal-content-inner")}>
            {groups.map(group => {
                const open = !collapsed.has(group.id);

                return (
                    <section key={group.id} className={cl("group")}>
                        <GroupHeader
                            level="top"
                            open={open}
                            onToggle={() => toggle(group.id)}
                            icon={group.icon
                                ? <img className={cl("group-icon")} src={group.icon} alt="" />
                                : <span className={cl("group-icon")} aria-hidden>
                                    {group.kind === "dm" ? "@" : group.name.split(/\s+/).map(w => w[0]).join("").slice(0, 3)}
                                </span>}
                            label={group.name}
                            meta={showCounts
                                ? [
                                    group.kind === "guild" ? plural(group.channels.length, "channel") : null,
                                    plural(group.count, "message")
                                ]
                                : []}
                            timeLabel={timeLabel}
                            timestamp={group.firstTimestamp}
                        />

                        {open && (
                            <div className={cl("group-body")}>
                                {group.kind === "dm" && (
                                    <div className={cl("group-messages")}>
                                        {renderMessages(group.channels[0].records)}
                                    </div>
                                )}

                                {group.kind === "guild" && group.channels.map(channel => {
                                    const channelKey = `${group.id}/${channel.id}`;
                                    const channelOpen = !collapsed.has(channelKey);

                                    return (
                                        <div key={channel.id} className={cl("group-channel")}>
                                            <GroupHeader
                                                level="channel"
                                                open={channelOpen}
                                                onToggle={() => toggle(channelKey)}
                                                icon={<span className={cl("group-hash")} aria-hidden>#</span>}
                                                label={channel.name}
                                                meta={showCounts ? [plural(channel.records.length, "message")] : []}
                                                timeLabel={timeLabel}
                                                timestamp={channel.records[0]?.message.timestamp}
                                            />
                                            {channelOpen && (
                                                <div className={cl("group-messages")}>
                                                    {renderMessages(channel.records)}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                );
            })}
            {
                canLoadMore &&
                <Button
                    style={{ marginTop: "1rem", width: "100%" }}
                    size="small" onClick={() => handleLoadMore()}
                >
                    Load More
                </Button>
            }
        </div>
    );
}

interface GroupHeaderProps {
    level: "top" | "channel";
    open: boolean;
    onToggle: () => void;
    label: string;
    meta: (string | null)[];
    timeLabel: string;
    timestamp: any;
    icon?: React.ReactNode;
}

function GroupHeader({ level, open, onToggle, label, meta, timeLabel, timestamp, icon }: GroupHeaderProps) {
    const relative = formatRelative(timestamp);

    return (
        <button
            type="button"
            className={`${cl("group-header")} ${level === "top" ? cl("group-header-top") : cl("group-header-channel")}`}
            aria-expanded={open}
            onClick={onToggle}
        >
            <span className={cl("group-chevron")} aria-hidden>{open ? "▾" : "▸"}</span>
            {icon}
            <span className={cl("group-label")}>{label}</span>
            <span className={cl("group-meta")}>
                {meta.filter(Boolean).map(m => <span key={m}>{m}</span>)}
                {relative && <span title={formatDay(timestamp)}>{timeLabel} {relative}</span>}
            </span>
        </button>
    );
}

function DayDivider({ timestamp }: { timestamp: any; }) {
    return (
        <div className={cl("day-divider")} role="separator">
            <span>{formatDay(timestamp)}</span>
        </div>
    );
}

const LogsContentMemo = LazyComponent(() => LogsContent);

function NoResults({ tab }: { tab: LogTabs; }) {
    const generateSuggestedTabs = (tab: LogTabs) => {
        switch (tab) {
            case LogTabs.DELETED:
                return { nextTab: LogTabs.EDITED, lastTab: LogTabs.GHOST_PING };
            case LogTabs.EDITED:
                return { nextTab: LogTabs.GHOST_PING, lastTab: LogTabs.DELETED };
            case LogTabs.GHOST_PING:
                return { nextTab: LogTabs.DELETED, lastTab: LogTabs.EDITED };
            default:
                return { nextTab: "", lastTab: "" };
        }
    };

    const { nextTab, lastTab } = generateSuggestedTabs(tab);

    return (
        <div className={cl("modal-empty-logs", "modal-content-inner")} style={{ textAlign: "center" }}>
            <Text size="lg">
                No results in <b>{tab}</b>.
            </Text>
            <Text size="lg" style={{ marginTop: "0.2rem" }}>
                Maybe try <b>{nextTab}</b> or <b>{lastTab}</b>
            </Text>
        </div>
    );
}

function EmptyLogs({ hasQuery, reset: forceUpdate }: { hasQuery: boolean; reset: () => void; }) {
    return (
        <div className={cl("modal-empty-logs", "modal-content-inner")} style={{ textAlign: "center" }}>
            <Flex flexDirection="column" style={{ position: "relative" }}>

                <Text size="lg">
                    Empty eh
                </Text>

                {!hasQuery && (
                    <>
                        <Tooltip text="ML Enhanced now stores logs in indexeddb. You need to import your old logs from the logs directory. Importing wont overwrite existing logs">
                            {({ onMouseEnter, onMouseLeave }) => (
                                <div
                                    className={cl("modal-info-icon")}
                                    onMouseEnter={onMouseEnter}
                                    onMouseLeave={onMouseLeave}
                                >
                                    <InfoIcon />
                                </div>
                            )}
                        </Tooltip>

                        <Button onClick={() => importLogs().then(() => forceUpdate())}>
                            Import Logs
                        </Button>
                    </>
                )}
            </Flex>
        </div>
    );
}

function LoadingLogs({ tab }: { tab: LogTabs; }) {
    return (
        <div className={cl("modal-empty-logs", "modal-content-inner")} style={{ textAlign: "center" }}>
            <Flex flexDirection="column" style={{ position: "relative" }}>
                <Text size="lg">
                    Loading {tab} Logs...
                </Text>
            </Flex>
        </div>
    );

}

/* ------------------------------------------------------------------ */
/* message row                                                         */
/* ------------------------------------------------------------------ */

interface LMessageProps {
    log: { message: LoggedMessageJSON; };
    isGroupStart: boolean,
    reset: () => void;
}
function LMessage({ log, isGroupStart, reset, }: LMessageProps) {
    const message = useMemo(() => messageJsonToMessageClass(log), [log]);

    if (!message) return null;

    return (
        <div
            onContextMenu={e => {
                ContextMenuApi.openContextMenu(e, () =>
                    <Menu.Menu
                        navId="message-logger"
                        onClose={() => FluxDispatcher.dispatch({ type: "CONTEXT_MENU_CLOSE" })}
                        aria-label="Message Logger"
                    >

                        <Menu.MenuItem
                            key="jump-to-message"
                            id="jump-to-message"
                            label="Jump To Message"
                            action={() => {
                                NavigationRouter.transitionTo(`/channels/${ChannelStore.getChannel(message.channel_id)?.guild_id ?? "@me"}/${message.channel_id}${message.id ? "/" + message.id : ""}`);
                                closeAllModals();
                            }}
                        />
                        <Menu.MenuItem
                            key="open-user-profile"
                            id="open-user-profile"
                            label="Open user profile"
                            action={() => {
                                closeAllModals();
                                openUserProfile(message.author.id);
                            }}
                        />

                        <Menu.MenuItem
                            key="copy-content"
                            id="copy-content"
                            label="Copy Content"
                            action={() => copyWithToast(message.content)}
                        />

                        <Menu.MenuItem
                            key="copy-user-id"
                            id="copy-user-id"
                            label="Copy User ID"
                            action={() => copyWithToast(message.author.id)}
                        />

                        <Menu.MenuItem
                            key="copy-message-id"
                            id="copy-message-id"
                            label="Copy Message ID"
                            action={() => copyWithToast(message.id)}
                        />

                        <Menu.MenuItem
                            key="copy-channel-id"
                            id="copy-channel-id"
                            label="Copy Channel ID"
                            action={() => copyWithToast(message.channel_id)}
                        />

                        {
                            log.message.guildId != null
                            && (
                                <Menu.MenuItem
                                    key="copy-server-id"
                                    id="copy-server-id"
                                    label="Copy Server ID"
                                    action={() => copyWithToast(log.message.guildId!)}
                                />
                            )
                        }

                        <Menu.MenuItem
                            key="delete-log"
                            id="delete-log"
                            label="Delete Log"
                            color="danger"
                            action={() =>
                                deleteMessageIDB(log.message.id).then(() => reset())
                            }
                        />

                    </Menu.Menu>
                );
            }}>
            <MessagePreview
                className={`${cl("modal-msg-preview")} ${message.deleted ? "messagelogger-deleted" : ""}`}
                author={message.author}
                message={message}
                channel={ChannelStore.getChannel(message.channel_id) || new PrivateChannelRecord({ id: "" })}
                compact={false}
                isGroupStart={isGroupStart}
                hideSimpleEmbedContent={false}
            />
        </div>
    );
}

export const openLogModal = (initalQuery?: string) => openModal(modalProps => <LogsModal modalProps={modalProps} initalQuery={initalQuery} />);

function isGroupStart(
    currentMessage: LoggedMessageJSON | undefined,
    previousMessage: LoggedMessageJSON | undefined,
    sortNewest: boolean
) {
    if (!currentMessage || !previousMessage) return true;

    if (currentMessage.id === previousMessage.id) return true;

    const [newestMessage, oldestMessage] = sortNewest
        ? [previousMessage, currentMessage]
        : [currentMessage, previousMessage];

    if (newestMessage.author.id !== oldestMessage.author.id) return true;

    const timeDifferenceInMinutes = Math.abs(
        (new Date(newestMessage.timestamp)?.getTime() - new Date(oldestMessage.timestamp)?.getTime()) / (1000 * 60)
    );

    return timeDifferenceInMinutes >= 5;
}