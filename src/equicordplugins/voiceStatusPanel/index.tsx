/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import * as DataStore from "@api/DataStore";
import { HeaderBarButton } from "@api/HeaderBar";
import ErrorBoundary from "@components/ErrorBoundary";
import { CopyIcon, MagnifyingGlassIcon, ScreenshareIcon, ShieldIcon, VideoIcon } from "@components/Icons";
import { EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { copyWithToast, getTheme, openUserProfile, Theme } from "@utils/discord";
import { Logger } from "@utils/Logger";
import { classes, pluralise, sleep } from "@utils/misc";
import { useFixedTimer } from "@utils/react";
import definePlugin from "@utils/types";
import { findComponentByCodeLazy, proxyLazyWebpack } from "@webpack";
import { Alerts, Avatar, Button, ChannelRouter, ChannelStore, Clickable, Constants, ContextMenuApi, GuildActions, GuildMemberStore, IconUtils, Menu, moment, PermissionsBits, PermissionStore, PopoutActions, PopoutWindowStore, React, RestAPI, SelectedChannelStore, showToast, TextInput, Toasts, Tooltip, UserStore, useStateFromStores, VoiceStateStore } from "@webpack/common";
import type { ReactNode } from "react";

import { DeafenedIcon, MutedIcon, SelectIcon, SpeakerIcon, XIcon } from "./icons";
import { settings } from "./settings";
import { AVATAR_TIERS, type AvatarTier, clampNum, getDisplayName, getVoiceChannels, GROUP_KEYS, type Groups, moveUser, pickAvatarTier, sameGroups, shortDuration } from "./utils";

const cl = classNameFactory("vc-vsp-");
const logger = new Logger("VoiceStatusPanel");

const PopoutWindow = findComponentByCodeLazy("Missing guestWindow reference");
const WINDOW_KEY = "DISCORD_VC_STATUS_PANEL";

function createVersionStore() {
    let version = 0;
    const listeners = new Set<() => void>();
    return {
        subscribe: (listener: () => void) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        getVersion: () => version,
        emit: () => {
            version++;
            listeners.forEach(listener => listener());
        }
    };
}

const speakingUsers = new Set<string>();
const speakingStore = createVersionStore();

const bulkStore = createVersionStore();

const IGNORE_LIST_KEY = "VoiceStatusPanel_ignoredUserIds";
const SNOWFLAKE_RE = /^\d{17,20}$/;

let ignoredIds = new Set<string>();
const ignoredStore = createVersionStore();

DataStore.get<string[]>(IGNORE_LIST_KEY).then(saved => {
    if (saved?.length) {
        ignoredIds = new Set(saved);
        ignoredStore.emit();
    }
}).catch(e => logger.error("Failed to load ignore list", e));

function persistIgnored() {
    DataStore.set(IGNORE_LIST_KEY, [...ignoredIds]).catch(e => logger.error("Failed to save ignore list", e));
}

function addIgnored(id: string) {
    if (ignoredIds.has(id)) return;
    ignoredIds = new Set(ignoredIds).add(id);
    persistIgnored();
    ignoredStore.emit();
}

function removeIgnored(id: string) {
    if (!ignoredIds.has(id)) return;
    const next = new Set(ignoredIds);
    next.delete(id);
    ignoredIds = next;
    persistIgnored();
    ignoredStore.emit();
}

type LogCategory = "joins" | "voice" | "media";

interface LogEntry {
    id: number;
    ts: number;
    userId: string;
    text: string;
    color: string;
    cat: LogCategory;
}

const joinTimes = new Map<string, number>();

const activityLog: LogEntry[] = [];
let logId = 0;
let myJoinedAt = 0;
const logStore = createVersionStore();

interface PrevVoiceState {
    mute: boolean;
    deaf: boolean;
    selfMute: boolean;
    selfDeaf: boolean;
    selfVideo: boolean;
    selfStream: boolean;
}

const prevStates = new Map<string, PrevVoiceState>();

function addLog(userId: string, text: string, color: string, cat: LogCategory) {
    activityLog.unshift({ id: logId++, ts: Date.now(), userId, text, color, cat });
    if (activityLog.length > 100) activityLog.length = 100;
    logStore.emit();
}

function clearLog() {
    activityLog.length = 0;
    prevStates.clear();
    logStore.emit();
}

let bulkRunning = false;
async function runBulk(targets: string[], guildId: string, body: Record<string, unknown>, done: (n: number) => string) {
    if (!targets.length) return;
    if (bulkRunning) {
        showToast("A bulk action is already in progress.", Toasts.Type.FAILURE);
        return;
    }
    bulkRunning = true;
    bulkStore.emit();

    let ok = 0;
    try {
        for (const userId of targets) {
            try {
                await RestAPI.patch({ url: Constants.Endpoints.GUILD_MEMBER(guildId, userId), body });
                ok++;
            } catch (e) {
                logger.error("Bulk action failed for", userId, e);
            }
            await sleep(300);
        }
    } finally {
        bulkRunning = false;
        bulkStore.emit();
    }

    if (ok) showToast(done(ok), Toasts.Type.SUCCESS);
    else showToast("Action failed, check your permissions.", Toasts.Type.FAILURE);
}

function voiceStates(channelId: string) {
    return Object.values(VoiceStateStore.getVoiceStatesForChannel(channelId));
}

function othersInChannel(channelId: string) {
    const myId = UserStore.getCurrentUser().id;
    return voiceStates(channelId).filter(s => s.userId !== myId && !ignoredIds.has(s.userId));
}

function RowCheckbox({ selected }: { selected: boolean; }) {
    return (
        <svg className={cl("checkbox")} width="18" height="18" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="18" height="18" rx="6" fill={selected ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" />
            {selected && (
                <path d="M7 12.5l3 3 7-7" stroke="var(--vsp-bg)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            )}
        </svg>
    );
}

const AvatarScaleContext = proxyLazyWebpack(() => React.createContext<AvatarTier>(AVATAR_TIERS[0]));

function useElementWidth(ref: React.RefObject<HTMLElement | null>) {
    const [width, setWidth] = React.useState(960);

    React.useEffect(() => {
        const node = ref.current;
        if (!node || typeof ResizeObserver === "undefined") return;

        const observer = new ResizeObserver(entries => {
            const entry = entries[0];
            if (entry) setWidth(entry.contentRect.width);
        });
        observer.observe(node);
        return () => observer.disconnect();
    }, [ref]);

    return width;
}

function getGroups(channelId: string, guildId: string | null): Groups {
    const groups: Groups = { speaking: [], live: [], listening: [], muted: [], deafened: [] };
    for (const s of voiceStates(channelId)) {
        if (s.deaf || s.selfDeaf) groups.deafened.push(s.userId);
        else if (s.mute || s.selfMute || s.suppress) groups.muted.push(s.userId);
        else if (s.selfStream) groups.live.push(s.userId);
        else if (speakingUsers.has(s.userId)) groups.speaking.push(s.userId);
        else groups.listening.push(s.userId);
    }

    for (const key of GROUP_KEYS) {
        groups[key].sort((a, b) =>
            getDisplayName(guildId, a).localeCompare(getDisplayName(guildId, b), undefined, { sensitivity: "base" })
        );
    }
    return groups;
}

function openBulkMoveMenu(event: React.UIEvent, { guildId, channelId, userIds }: { guildId: string; channelId: string; userIds: string[]; }) {
    const otherChannels = getVoiceChannels(guildId).filter(c => c.id !== channelId);
    if (!otherChannels.length) {
        showToast("No other voice channels to move to.", Toasts.Type.FAILURE);
        return;
    }

    ContextMenuApi.openContextMenu(event, () => (
        <Menu.Menu navId="vc-status-panel-bulk-move" onClose={ContextMenuApi.closeContextMenu} aria-label="Move Users">
            {otherChannels.map(c => (
                <Menu.MenuItem
                    key={c.id}
                    id={`vsp-bulk-move-${c.id}`}
                    label={c.name}
                    action={() => runBulk(userIds, guildId, { channel_id: c.id }, n => `Moved ${pluralise(n, "user")} to ${c.name}.`)}
                />
            ))}
        </Menu.Menu>
    ));
}

function openUserModMenu(event: React.UIEvent, { userId, channelId, guildId }: { userId: string; channelId: string; guildId: string; }) {
    const channel = ChannelStore.getChannel(channelId);
    if (!channel) return;

    const isSelf = userId === UserStore.getCurrentUser().id;
    const canMute = !isSelf && PermissionStore.can(PermissionsBits.MUTE_MEMBERS, channel);
    const canDeafen = !isSelf && PermissionStore.can(PermissionsBits.DEAFEN_MEMBERS, channel);
    const canMove = !isSelf && PermissionStore.can(PermissionsBits.MOVE_MEMBERS, channel);

    const state = VoiceStateStore.getVoiceStateForChannel(channelId, userId);
    const isMuted = !!state?.mute;
    const isDeafened = !!state?.deaf;

    const otherChannels = canMove ? getVoiceChannels(guildId).filter(c => c.id !== channelId) : [];

    ContextMenuApi.openContextMenu(event, () => (
        <Menu.Menu navId="vc-status-panel-user" onClose={ContextMenuApi.closeContextMenu} aria-label="Voice User Actions">
            <Menu.MenuItem id="vsp-profile" label="View Profile" action={() => openUserProfile(userId)} />
            <Menu.MenuItem id="vsp-copy-id" label="Copy User ID" action={() => copyWithToast(userId, "Copied user ID.")} />
            {(canMute || canDeafen || canMove) && <Menu.MenuSeparator />}
            {canMute && (
                <Menu.MenuItem
                    id="vsp-mute"
                    label={isMuted ? "Server Unmute" : "Server Mute"}
                    action={() => GuildActions.setServerMute(guildId, userId, !isMuted)}
                />
            )}
            {canDeafen && (
                <Menu.MenuItem
                    id="vsp-deafen"
                    label={isDeafened ? "Server Undeafen" : "Server Deafen"}
                    action={() => GuildActions.setServerDeaf(guildId, userId, !isDeafened)}
                />
            )}
            {canMove && otherChannels.length > 0 && (
                <Menu.MenuItem id="vsp-move" label="Move To">
                    {otherChannels.map(c => (
                        <Menu.MenuItem
                            key={c.id}
                            id={`vsp-move-${c.id}`}
                            label={c.name}
                            action={() => moveUser(guildId, userId, c.id).catch(e => {
                                logger.error("Failed to move user", userId, e);
                                showToast("Could not move that user.", Toasts.Type.FAILURE);
                            })}
                        />
                    ))}
                </Menu.MenuItem>
            )}
            {canMove && (
                <Menu.MenuItem
                    id="vsp-disconnect"
                    label="Disconnect"
                    color="danger"
                    action={() => RestAPI.patch({ url: Constants.Endpoints.GUILD_MEMBER(guildId, userId), body: { channel_id: null } }).catch(e => {
                        logger.error("Failed to disconnect", userId, e);
                        showToast("Could not disconnect that user.", Toasts.Type.FAILURE);
                    })}
                />
            )}
        </Menu.Menu>
    ));
}

function VoiceUserRow({ userId, channelId, guildId, speaking, selectMode, selected, onToggleSelect }: {
    userId: string;
    channelId: string;
    guildId: string | null;
    speaking: boolean;
    selectMode: boolean;
    selected: boolean;
    onToggleSelect: (userId: string) => void;
}) {
    const user = useStateFromStores([UserStore], () => UserStore.getUser(userId), [userId]);
    const name = useStateFromStores([UserStore, GuildMemberStore], () => getDisplayName(guildId, userId), [guildId, userId]);
    const { video, streaming, detail } = useStateFromStores([VoiceStateStore], () => {
        const s = VoiceStateStore.getVoiceStateForChannel(channelId, userId);
        let detail = "";
        if (s?.deaf) detail = "Server deafened";
        else if (s?.mute) detail = "Server muted";
        else if (s?.suppress) detail = "Suppressed";
        return { video: !!s?.selfVideo, streaming: !!s?.selfStream, detail };
    }, [channelId, userId], (a, b) => a.video === b.video && a.streaming === b.streaming && a.detail === b.detail);

    const avatarTier = React.useContext(AvatarScaleContext);

    if (!user) return null;

    const joinedAt = joinTimes.get(userId);
    const isSelf = userId === UserStore.getCurrentUser().id;

    const canSelect = selectMode && !isSelf;

    return (
        <Clickable
            className={cl("row", { speaking, selectable: canSelect, selected: canSelect && selected })}
            onClick={() => canSelect ? onToggleSelect(userId) : openUserProfile(userId)}
            onContextMenu={guildId ? e => openUserModMenu(e, { userId, channelId, guildId }) : undefined}
        >
            {canSelect && (
                <span
                    className={cl("check", { "check-active": selected })}
                    onClick={e => {
                        e.stopPropagation();
                        onToggleSelect(userId);
                    }}
                >
                    <RowCheckbox selected={selected} />
                </span>
            )}
            <span className={cl("avatar-wrap", { "avatar-wrap-selected": canSelect && selected })}>
                <Avatar
                    src={IconUtils.getUserAvatarURL(user, false, avatarTier.px)}
                    size={avatarTier.size}
                    isSpeaking={speaking}
                    aria-hidden
                />
            </span>
            <div className={cl("row-text")}>
                <span className={cl("row-name")}>{name}</span>
                <span className={cl("row-detail")}>
                    @{user.username}{joinedAt ? ` · ${shortDuration(Date.now() - joinedAt)}` : ""}
                </span>
            </div>
            {isSelf ? <span className={cl("you")}>YOU</span> : null}
            {detail ? (
                <Tooltip text={detail}>
                    {props => <span {...props} className={cl("badge")}>SERVER</span>}
                </Tooltip>
            ) : null}
            {streaming && (
                <Tooltip text="Streaming">
                    {props => <span {...props} className={cl("live")}>LIVE</span>}
                </Tooltip>
            )}
            {video && (
                <Tooltip text="Camera on">
                    {props => <span {...props} className={cl("camera")}><VideoIcon width={16} height={16} /></span>}
                </Tooltip>
            )}
        </Clickable>
    );
}

function Column({ title, color, icon, userIds, channelId, guildId, action, selectMode, selectedIds, onToggleSelect }: {
    title: string;
    color: string;
    icon: ReactNode;
    userIds: string[];
    channelId: string;
    guildId: string | null;
    action?: ReactNode;
    selectMode: boolean;
    selectedIds: Set<string>;
    onToggleSelect: (userId: string) => void;
}) {
    return (
        <div className={cl("column", `column-${color}`)}>
            <div className={cl("column-header", `color-${color}`)}>
                {icon}
                <span className={cl("column-title")}>{title}</span>
                {action}
                <span className={cl("column-count")}>{userIds.length}</span>
            </div>
            <div className={cl("column-list")}>
                {userIds.length
                    ? userIds.map(id => (
                        <VoiceUserRow
                            key={id}
                            userId={id}
                            channelId={channelId}
                            guildId={guildId}
                            speaking={speakingUsers.has(id)}
                            selectMode={selectMode}
                            selected={selectedIds.has(id)}
                            onToggleSelect={onToggleSelect}
                        />
                    ))
                    : <div className={cl("column-empty")}>Nobody</div>}
            </div>
        </div>
    );
}

function StaffActions({ channelId, guildId }: { channelId: string; guildId: string; }) {
    React.useSyncExternalStore(bulkStore.subscribe, bulkStore.getVersion);
    const busy = bulkRunning;

    const perms = useStateFromStores([PermissionStore], () => {
        const channel = ChannelStore.getChannel(channelId);
        return {
            kick: !!channel && PermissionStore.can(PermissionsBits.MOVE_MEMBERS, channel),
            mute: !!channel && PermissionStore.can(PermissionsBits.MUTE_MEMBERS, channel),
            deafen: !!channel && PermissionStore.can(PermissionsBits.DEAFEN_MEMBERS, channel)
        };
    }, [channelId], (a, b) => a.kick === b.kick && a.mute === b.mute && a.deafen === b.deafen);

    if (!perms.kick && !perms.mute && !perms.deafen) return null;

    return (
        <div className={cl("staff")}>
            <span className={cl("staff-label")}>Staff actions</span>
            {perms.kick && (
                <Button
                    size={Button.Sizes.SMALL}
                    color={Button.Colors.RED}
                    disabled={busy}
                    onClick={() => {
                        const targets = othersInChannel(channelId).map(s => s.userId);
                        Alerts.show({
                            title: "Disconnect everyone?",
                            body: `This will disconnect ${pluralise(targets.length, "user")} from the channel.`,
                            confirmText: "Disconnect all",
                            confirmColor: Button.Colors.RED,
                            cancelText: "Cancel",
                            onConfirm: () => runBulk(
                                targets, guildId, { channel_id: null },
                                n => `Disconnected ${pluralise(n, "user")}.`
                            )
                        });
                    }}
                >
                    Disconnect all
                </Button>
            )}
            {perms.kick && (
                <Button
                    size={Button.Sizes.SMALL}
                    color={Button.Colors.RED}
                    disabled={busy}
                    onClick={() => runBulk(
                        othersInChannel(channelId).filter(s => s.deaf || s.selfDeaf).map(s => s.userId),
                        guildId, { channel_id: null },
                        n => `Disconnected ${pluralise(n, "deafened user")}.`
                    )}
                >
                    Disconnect deafened
                </Button>
            )}
            {perms.mute && (
                <Button
                    size={Button.Sizes.SMALL}
                    color={Button.Colors.PRIMARY}
                    disabled={busy}
                    onClick={() => runBulk(
                        othersInChannel(channelId).filter(s => !s.mute).map(s => s.userId),
                        guildId, { mute: true },
                        n => `Server muted ${pluralise(n, "user")}.`
                    )}
                >
                    Mute all
                </Button>
            )}
            {perms.mute && (
                <Button
                    size={Button.Sizes.SMALL}
                    color={Button.Colors.PRIMARY}
                    disabled={busy}
                    onClick={() => runBulk(
                        othersInChannel(channelId).filter(s => s.mute).map(s => s.userId),
                        guildId, { mute: false },
                        n => `Unmuted ${pluralise(n, "user")}.`
                    )}
                >
                    Unmute all
                </Button>
            )}
            {perms.deafen && (
                <Button
                    size={Button.Sizes.SMALL}
                    color={Button.Colors.PRIMARY}
                    disabled={busy}
                    onClick={() => runBulk(
                        othersInChannel(channelId).filter(s => s.deaf).map(s => s.userId),
                        guildId, { deaf: false },
                        n => `Undeafened ${pluralise(n, "user")}.`
                    )}
                >
                    Undeafen all
                </Button>
            )}
        </div>
    );
}

function SelectionBar({ channelId, guildId, selectedIds, onSelectAll, onClear, onExit }: {
    channelId: string;
    guildId: string | null;
    selectedIds: Set<string>;
    onSelectAll: () => void;
    onClear: () => void;
    onExit: () => void;
}) {
    React.useSyncExternalStore(bulkStore.subscribe, bulkStore.getVersion);
    React.useSyncExternalStore(ignoredStore.subscribe, ignoredStore.getVersion);
    const busy = bulkRunning;

    const perms = useStateFromStores([PermissionStore], () => {
        const channel = ChannelStore.getChannel(channelId);
        return {
            move: !!channel && !!guildId && PermissionStore.can(PermissionsBits.MOVE_MEMBERS, channel),
            mute: !!channel && !!guildId && PermissionStore.can(PermissionsBits.MUTE_MEMBERS, channel),
            deafen: !!channel && !!guildId && PermissionStore.can(PermissionsBits.DEAFEN_MEMBERS, channel)
        };
    }, [channelId, guildId], (a, b) => a.move === b.move && a.mute === b.mute && a.deafen === b.deafen);

    const myId = UserStore.getCurrentUser().id;
    const targets = guildId
        ? [...selectedIds].filter(id => id !== myId && !ignoredIds.has(id) && voiceStates(channelId).some(s => s.userId === id))
        : [];
    const count = targets.length;

    return (
        <div className={cl("selection-bar")}>
            <span className={cl("staff-label")}>{count ? `${pluralise(count, "user")} selected` : "Select users"}</span>
            <div className={cl("selection-chips")}>
                <Clickable className={cl("log-chip")} onClick={onSelectAll}>Select all</Clickable>
                {count > 0 && <Clickable className={cl("log-chip")} onClick={onClear}>Clear</Clickable>}
            </div>
            {guildId && count > 0 && (
                <>
                    <span className={cl("selection-divider")} />
                    <div className={cl("selection-actions")}>
                        {perms.mute && (
                            <Button size={Button.Sizes.SMALL} color={Button.Colors.BRAND} disabled={busy} onClick={() => runBulk(
                                targets, guildId, { mute: true }, n => `Server muted ${pluralise(n, "user")}.`
                            )}>
                                Mute
                            </Button>
                        )}
                        {perms.mute && (
                            <Button size={Button.Sizes.SMALL} color={Button.Colors.PRIMARY} disabled={busy} onClick={() => runBulk(
                                targets, guildId, { mute: false }, n => `Unmuted ${pluralise(n, "user")}.`
                            )}>
                                Unmute
                            </Button>
                        )}
                        {perms.deafen && (
                            <Button size={Button.Sizes.SMALL} color={Button.Colors.BRAND} disabled={busy} onClick={() => runBulk(
                                targets, guildId, { deaf: true }, n => `Server deafened ${pluralise(n, "user")}.`
                            )}>
                                Deafen
                            </Button>
                        )}
                        {perms.deafen && (
                            <Button size={Button.Sizes.SMALL} color={Button.Colors.PRIMARY} disabled={busy} onClick={() => runBulk(
                                targets, guildId, { deaf: false }, n => `Undeafened ${pluralise(n, "user")}.`
                            )}>
                                Undeafen
                            </Button>
                        )}
                        {perms.move && (
                            <Button
                                size={Button.Sizes.SMALL}
                                color={Button.Colors.PRIMARY}
                                disabled={busy}
                                onClick={e => openBulkMoveMenu(e, { guildId, channelId, userIds: targets })}
                            >
                                Move to…
                            </Button>
                        )}
                        {perms.move && (
                            <Button size={Button.Sizes.SMALL} color={Button.Colors.RED} disabled={busy} onClick={() => runBulk(
                                targets, guildId, { channel_id: null }, n => `Disconnected ${pluralise(n, "user")}.`
                            )}>
                                Disconnect
                            </Button>
                        )}
                    </div>
                </>
            )}
            <Clickable className={cl("selection-exit")} onClick={onExit}>Done</Clickable>
        </div>
    );
}

function IgnoreListPanel() {
    React.useSyncExternalStore(ignoredStore.subscribe, ignoredStore.getVersion);
    const [input, setInput] = React.useState("");

    const handleAdd = () => {
        const id = input.trim();
        if (!id) return;
        if (!SNOWFLAKE_RE.test(id)) {
            showToast("That doesn't look like a valid user ID.", Toasts.Type.FAILURE);
            return;
        }
        addIgnored(id);
        setInput("");
    };

    const ids = [...ignoredIds];

    return (
        <div className={cl("ignore-panel")}>
            <div className={cl("ignore-row")}>
                <span className={cl("staff-label")}>
                    Protected users{ids.length ? ` (${ids.length})` : ""}
                </span>
                <div className={cl("ignore-input")}>
                    <TextInput
                        value={input}
                        onChange={setInput}
                        placeholder="Paste a user ID"
                        onKeyDown={e => {
                            if (e.key === "Enter") handleAdd();
                        }}
                    />
                </div>
                <Clickable className={cl("log-chip")} onClick={handleAdd}>Add</Clickable>
            </div>
            {ids.length > 0 && (
                <div className={cl("ignore-chips")}>
                    {ids.map(id => {
                        const user = UserStore.getUser(id);
                        return (
                            <span key={id} className={cl("ignore-chip")}>
                                {user ? getDisplayName(null, id) || user.username : id}
                                <Clickable className={cl("ignore-remove")} onClick={() => removeIgnored(id)}>
                                    <XIcon />
                                </Clickable>
                            </span>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

const LOG_FILTERS = [
    { id: "all", label: "All" },
    { id: "joins", label: "Joins" },
    { id: "voice", label: "Mutes" },
    { id: "media", label: "Media" }
] as const;

function ActivityLog({ guildId }: { guildId: string | null; }) {
    React.useSyncExternalStore(logStore.subscribe, logStore.getVersion);
    const [filter, setFilter] = React.useState<"all" | LogCategory>("all");

    const entries = filter === "all" ? activityLog : activityLog.filter(e => e.cat === filter);

    return (
        <div className={cl("log")}>
            <div className={cl("log-header")}>
                <span className={cl("log-title")}>Activity</span>
                {LOG_FILTERS.map(f => (
                    <Clickable
                        key={f.id}
                        className={cl("log-chip", { "log-chip-active": filter === f.id })}
                        onClick={() => setFilter(f.id)}
                    >
                        {f.label}
                    </Clickable>
                ))}
                <Clickable className={cl("log-clear")} onClick={clearLog}>Clear</Clickable>
            </div>
            <div className={cl("log-list")}>
                {entries.length
                    ? entries.map(e => (
                        <div key={e.id} className={cl("log-row")}>
                            <span className={cl("log-time")}>{moment(e.ts).format("HH:mm:ss")}</span>
                            <span className={cl("log-dot", `dot-${e.color}`)} />
                            <span className={cl("log-name")}>{getDisplayName(guildId, e.userId) || "Unknown"}</span>
                            <span className={cl("log-text")}>{e.text}</span>
                        </div>
                    ))
                    : <div className={cl("column-empty")}>No activity yet.</div>}
            </div>
        </div>
    );
}

function windowClass() {
    const mode = settings.store.theme;
    const isLight = mode === "light" || (mode !== "dark" && getTheme() === Theme.Light);
    return classes(cl("window"), isLight ? "theme-light" : "theme-dark");
}

function snapshotAccentVars(): React.CSSProperties {
    if (!document.documentElement.classList.contains("custom-theme-background")) return {};

    const gradient = getComputedStyle(document.documentElement).getPropertyValue("--custom-theme-background").trim();
    if (!gradient) return {};

    return { "--vsp-accent-gradient": gradient } as React.CSSProperties;
}

function VoiceStatusView({ accentVars }: { accentVars: React.CSSProperties; }) {
    const rootRef = React.useRef<HTMLDivElement>(null);
    const windowWidth = useElementWidth(rootRef);
    const avatarTier = pickAvatarTier(windowWidth);
    const useAccent = settings.store.theme === "match";
    const scaleVars = {
        ...(useAccent ? accentVars : null),
        "--vsp-fs": `${clampNum(13, windowWidth * 0.013, 30)}px`,
        "--vsp-pad": `${clampNum(12, windowWidth * 0.018, 40)}px`,
        "--vsp-gap": `${clampNum(8, windowWidth * 0.011, 26)}px`,
        "--vsp-radius": `${clampNum(8, windowWidth * 0.006, 18)}px`,
        "--vsp-card-opacity": `${settings.store.cardOpacity}%`
    } as React.CSSProperties;

    const channelId = useStateFromStores([SelectedChannelStore], () => SelectedChannelStore.getVoiceChannelId());
    const channelName = useStateFromStores(
        [ChannelStore],
        () => channelId ? ChannelStore.getChannel(channelId)?.name || "Voice Call" : "",
        [channelId]
    );
    const speakingTick = React.useSyncExternalStore(speakingStore.subscribe, speakingStore.getVersion);
    const groups = useStateFromStores(
        [VoiceStateStore],
        () => channelId
            ? getGroups(channelId, ChannelStore.getChannel(channelId)?.guild_id ?? null)
            : { speaking: [], live: [], listening: [], muted: [], deafened: [] },
        [channelId, speakingTick],
        sameGroups
    );
    const userLimit = useStateFromStores(
        [ChannelStore],
        () => channelId ? ChannelStore.getChannel(channelId)?.userLimit ?? 0 : 0,
        [channelId]
    );
    const [query, setQuery] = React.useState("");
    const [selectMode, setSelectMode] = React.useState(false);
    const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
    const [showIgnorePanel, setShowIgnorePanel] = React.useState(false);
    useFixedTimer({ interval: 60_000 });

    React.useEffect(() => {
        setSelectMode(false);
        setSelectedIds(new Set());
    }, [channelId]);

    const toggleSelected = React.useCallback((userId: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(userId)) next.delete(userId);
            else next.add(userId);
            return next;
        });
    }, []);

    if (!channelId) {
        return (
            <div className={windowClass()} ref={rootRef} style={scaleVars}>
                <div className={cl("empty")}>Join a voice channel to see who is connected.</div>
            </div>
        );
    }

    const guildId = ChannelStore.getChannel(channelId)?.guild_id ?? null;
    const total = GROUP_KEYS.reduce((n, k) => n + groups[k].length, 0);

    const q = query.trim().toLowerCase();
    const filterIds = (ids: string[]) => q
        ? ids.filter(id =>
            getDisplayName(guildId, id).toLowerCase().includes(q) ||
            UserStore.getUser(id)?.username.toLowerCase().includes(q))
        : ids;

    return (
        <div className={windowClass()} ref={rootRef} style={scaleVars}>
            <div className={cl("topbar")}>
                <div className={cl("topbar-row")}>
                    <div className={cl("channel-info")}>
                        <span className={cl("channel-icon")}><SpeakerIcon /></span>
                        <Tooltip text="Jump to channel">
                            {props => (
                                <Clickable {...props} className={cl("channel-link")} onClick={() => ChannelRouter.transitionToChannel(channelId)}>
                                    {channelName}
                                </Clickable>
                            )}
                        </Tooltip>
                        <span className={cl("count")}>
                            {userLimit ? `${total} / ${userLimit} connected` : `${pluralise(total, "user")} connected`}
                        </span>
                    </div>
                </div>
                <div className={cl("topbar-row")}>
                    {guildId && <StaffActions channelId={channelId} guildId={guildId} />}
                    <div className={cl("controls")}>
                        <div className={cl("search", { "search-has-value": query.length > 0 })}>
                            <span className={cl("search-icon")}><MagnifyingGlassIcon width={16} height={16} /></span>
                            <TextInput
                                value={query}
                                onChange={setQuery}
                                placeholder="Filter users"
                            />
                            {query.length > 0 && (
                                <Clickable className={cl("search-clear")} onClick={() => setQuery("")}>
                                    <XIcon />
                                </Clickable>
                            )}
                        </div>
                        {guildId && (
                            <Tooltip text={showIgnorePanel ? "Hide protected users" : "Protected users are skipped by bulk actions"}>
                                {props => (
                                    <Clickable
                                        {...props}
                                        className={cl("icon-btn", { "icon-btn-protect-active": showIgnorePanel })}
                                        onClick={() => setShowIgnorePanel(v => !v)}
                                    >
                                        <ShieldIcon width={16} height={16} />
                                    </Clickable>
                                )}
                            </Tooltip>
                        )}
                        {guildId && (
                            <Tooltip text={selectMode ? "Click users below to select or deselect them" : "Select users for bulk actions"}>
                                {props => (
                                    <Clickable
                                        {...props}
                                        className={cl("icon-btn", { "icon-btn-select-active": selectMode })}
                                        onClick={() => setSelectMode(v => !v)}
                                    >
                                        <SelectIcon />
                                        {selectMode && selectedIds.size > 0 && (
                                            <span className={cl("icon-badge")}>{selectedIds.size}</span>
                                        )}
                                    </Clickable>
                                )}
                            </Tooltip>
                        )}
                    </div>
                </div>
            </div>
            {guildId && showIgnorePanel && <IgnoreListPanel />}
            {guildId && selectMode && (
                <SelectionBar
                    channelId={channelId}
                    guildId={guildId}
                    selectedIds={selectedIds}
                    onSelectAll={() => {
                        const myId = UserStore.getCurrentUser().id;
                        setSelectedIds(new Set(GROUP_KEYS.flatMap(k => filterIds(groups[k])).filter(id => id !== myId)));
                    }}
                    onClear={() => setSelectedIds(new Set())}
                    onExit={() => { setSelectMode(false); setSelectedIds(new Set()); }}
                />
            )}
            <AvatarScaleContext.Provider value={avatarTier}>
                <div className={cl("columns")}>
                    <Column
                        title="Speaking" color="green" icon={<SpeakerIcon />}
                        userIds={filterIds(groups.speaking)} channelId={channelId} guildId={guildId}
                        selectMode={selectMode} selectedIds={selectedIds} onToggleSelect={toggleSelected}
                    />
                    <Column
                        title="Live" color="purple" icon={<ScreenshareIcon width={16} height={16} />}
                        userIds={filterIds(groups.live)} channelId={channelId} guildId={guildId}
                        selectMode={selectMode} selectedIds={selectedIds} onToggleSelect={toggleSelected}
                    />
                    <Column
                        title="Listening" color="gray" icon={<SpeakerIcon />}
                        userIds={filterIds(groups.listening)} channelId={channelId} guildId={guildId}
                        selectMode={selectMode} selectedIds={selectedIds} onToggleSelect={toggleSelected}
                    />
                    <Column
                        title="Muted" color="yellow" icon={<MutedIcon />}
                        userIds={filterIds(groups.muted)} channelId={channelId} guildId={guildId}
                        selectMode={selectMode} selectedIds={selectedIds} onToggleSelect={toggleSelected}
                    />
                    <Column
                        title="Deafened" color="red" icon={<DeafenedIcon />}
                        userIds={filterIds(groups.deafened)} channelId={channelId} guildId={guildId}
                        selectMode={selectMode} selectedIds={selectedIds} onToggleSelect={toggleSelected}
                        action={groups.deafened.length ? (
                            <Tooltip text="Copy mentions">
                                {props => (
                                    <Clickable
                                        {...props}
                                        className={cl("header-action")}
                                        onClick={() => {
                                            const myId = UserStore.getCurrentUser().id;
                                            const mentions = groups.deafened.filter(id => id !== myId).map(id => `<@${id}>`);
                                            if (mentions.length) copyWithToast(mentions.join(" "), "Copied deafened mentions to clipboard.");
                                            else showToast("Nobody to mention.", Toasts.Type.FAILURE);
                                        }}
                                    >
                                        <CopyIcon width={14} height={14} />
                                    </Clickable>
                                )}
                            </Tooltip>
                        ) : null}
                    />
                </div>
            </AvatarScaleContext.Provider>
            <ActivityLog guildId={guildId} />
        </div>
    );
}

const RenderPopout = ErrorBoundary.wrap(({ accentVars }: { accentVars: React.CSSProperties; }) => (
    <PopoutWindow withTitleBar windowKey={WINDOW_KEY} title="Voice Status">
        <VoiceStatusView accentVars={accentVars} />
    </PopoutWindow>
), { noop: true });

function togglePopout() {
    if (PopoutWindowStore.getWindowOpen(WINDOW_KEY)) {
        PopoutActions.close(WINDOW_KEY);
        return;
    }
    const accentVars = snapshotAccentVars();
    PopoutActions.open(WINDOW_KEY, () => <RenderPopout accentVars={accentVars} />, {
        defaultWidth: 1180,
        defaultHeight: 460
    });
}

function OpenPanelButton() {
    const inVoice = useStateFromStores([SelectedChannelStore], () => !!SelectedChannelStore.getVoiceChannelId());
    const isOpen = useStateFromStores([PopoutWindowStore], () => PopoutWindowStore.getWindowOpen(WINDOW_KEY));

    if (!inVoice && !isOpen) return null;

    return (
        <HeaderBarButton
            icon={SpeakerIcon}
            tooltip={isOpen ? "Close Voice Status" : "Open Voice Status"}
            selected={isOpen}
            onClick={togglePopout}
        />
    );
}

export default definePlugin({
    name: "VoiceStatusPanel",
    description: "Adds a voice status popout window showing who is speaking, listening, muted or deafened, with staff actions for voice moderation.",
    authors: [EquicordDevs.Drxzzle],
    tags: ["Voice"],
    dependencies: ["HeaderBarAPI"],
    settings,

    headerBarButton: {
        icon: SpeakerIcon,
        render: OpenPanelButton
    },

    flux: {
        SPEAKING({ userId, speakingFlags }: { userId: string; speakingFlags: number; }) {
            const speaking = (speakingFlags & 1) === 1;
            if (speaking === speakingUsers.has(userId)) return;
            if (speaking) speakingUsers.add(userId);
            else speakingUsers.delete(userId);
            speakingStore.emit();
        },

        VOICE_CHANNEL_SELECT({ channelId }: { channelId: string | null; }) {
            speakingUsers.clear();
            speakingStore.emit();
            clearLog();
            joinTimes.clear();
            if (channelId) {
                const myId = UserStore.getCurrentUser().id;
                myJoinedAt = Date.now();
                joinTimes.set(myId, myJoinedAt);

                for (const s of voiceStates(channelId)) {
                    if (s.userId === myId) continue;
                    joinTimes.set(s.userId, Date.now());
                    prevStates.set(s.userId, {
                        mute: s.mute,
                        deaf: s.deaf,
                        selfMute: s.selfMute,
                        selfDeaf: s.selfDeaf,
                        selfVideo: s.selfVideo,
                        selfStream: !!s.selfStream
                    });
                }
            } else if (PopoutWindowStore.getWindowOpen(WINDOW_KEY)) {
                PopoutActions.close(WINDOW_KEY);
            }
        },

        VOICE_STATE_UPDATES({ voiceStates: states }: { voiceStates: Array<PrevVoiceState & { userId: string; channelId: string | null; oldChannelId: string | null; }>; }) {
            const myChannelId = SelectedChannelStore.getVoiceChannelId();
            if (!myChannelId) return;

            const myId = UserStore.getCurrentUser().id;
            const suppressJoins = Date.now() - myJoinedAt < 3000;

            for (const s of states) {
                if (s.userId === myId) continue;

                if (s.oldChannelId !== s.channelId) {
                    if (s.channelId === myChannelId && !suppressJoins) {
                        addLog(s.userId, "joined the channel", "green", "joins");
                        joinTimes.set(s.userId, Date.now());
                    } else if (s.oldChannelId === myChannelId) {
                        if (!suppressJoins) addLog(s.userId, "left the channel", "red", "joins");
                        joinTimes.delete(s.userId);
                    }
                }

                if (s.channelId !== myChannelId) {
                    prevStates.delete(s.userId);
                    if (speakingUsers.delete(s.userId)) speakingStore.emit();
                    continue;
                }

                const prev = prevStates.get(s.userId);
                if (prev) {
                    if (s.mute !== prev.mute) addLog(s.userId, s.mute ? "was server muted" : "was server unmuted", "yellow", "voice");
                    if (s.deaf !== prev.deaf) addLog(s.userId, s.deaf ? "was server deafened" : "was server undeafened", "red", "voice");
                    if (s.selfMute !== prev.selfMute) addLog(s.userId, s.selfMute ? "muted themselves" : "unmuted themselves", "yellow", "voice");
                    if (s.selfDeaf !== prev.selfDeaf) addLog(s.userId, s.selfDeaf ? "deafened themselves" : "undeafened themselves", "red", "voice");
                    if (s.selfVideo !== prev.selfVideo) addLog(s.userId, s.selfVideo ? "turned their camera on" : "turned their camera off", "green", "media");
                    if (!!s.selfStream !== !!prev.selfStream) addLog(s.userId, s.selfStream ? "started streaming" : "stopped streaming", "purple", "media");
                }

                prevStates.set(s.userId, {
                    mute: s.mute,
                    deaf: s.deaf,
                    selfMute: s.selfMute,
                    selfDeaf: s.selfDeaf,
                    selfVideo: s.selfVideo,
                    selfStream: !!s.selfStream
                });
            }
        },

        VOICE_CHANNEL_EFFECT_SEND({ userId, channelId, soundId, emoji }: { userId: string; channelId: string; soundId?: string; emoji?: { name?: string; } | null; }) {
            if (!soundId) return;
            if (channelId !== SelectedChannelStore.getVoiceChannelId()) return;
            addLog(userId, emoji?.name ? `played soundboard ${emoji.name}` : "played a soundboard sound", "purple", "media");
        }
    },

    stop() {
        if (PopoutWindowStore.getWindowOpen(WINDOW_KEY)) PopoutActions.close(WINDOW_KEY);
    }
});
