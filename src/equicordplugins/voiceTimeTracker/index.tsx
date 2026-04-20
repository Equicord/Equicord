/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { HeaderBarButton } from "@api/HeaderBar";
import { DataStore } from "@api/index";
import { Notice } from "@components/Notice";
import { EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { openUserProfile } from "@utils/discord";
import { Logger } from "@utils/Logger";
import { classes } from "@utils/misc";
import { ModalCloseButton, ModalContent, ModalHeader, ModalProps, ModalRoot, ModalSize, openModal } from "@utils/modal";
import definePlugin from "@utils/types";
import { VoiceState } from "@vencord/discord-types";
import { Button, ChannelStore, GuildStore, IconUtils, RelationshipStore, SelectedChannelStore, TabBar, Text, Tooltip, useEffect, UserStore, useState, VoiceStateStore } from "@webpack/common";

const cl = classNameFactory("vc-vtt-");
const logger = new Logger("VoiceTimeTracker");
const CHANNEL_STORE_KEY = "VoiceTimeTracker_channels";
const USER_STORE_KEY = "VoiceTimeTracker_users";
const MESSAGES_STORE_KEY = "VoiceTimeTracker_messages";

let channelTimeData: Record<string, number> = {};
let userTimeData: Record<string, number> = {};
let messageCountData: Record<string, number> = {};
let joinTimestamp: number | null = null;
let currentChannelId: string | null = null;
const currentVoiceUsers = new Map<string, number>();

function formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
}

function flushCurrentSession() {
    if (!joinTimestamp || !currentChannelId) return;

    const elapsed = Date.now() - joinTimestamp;
    channelTimeData[currentChannelId] = (channelTimeData[currentChannelId] ?? 0) + elapsed;
    joinTimestamp = Date.now();

    flushUserSessions();
    save();
}

function flushUserSessions() {
    if (!currentChannelId) return;
    const now = Date.now();

    for (const [userId, startTime] of currentVoiceUsers) {
        const elapsed = now - startTime;
        const key = `${userId}:${currentChannelId}`;
        userTimeData[key] = (userTimeData[key] ?? 0) + elapsed;
        currentVoiceUsers.set(userId, now);
    }
}

function save() {
    DataStore.set(CHANNEL_STORE_KEY, channelTimeData).catch(e => logger.error("Failed to save channel time data", e));
    DataStore.set(USER_STORE_KEY, userTimeData).catch(e => logger.error("Failed to save user time data", e));
    DataStore.set(MESSAGES_STORE_KEY, messageCountData).catch(e => logger.error("Failed to save message count data", e));
}

function getGuildIconUrl(guildId: string): string | null {
    const guild = GuildStore.getGuild(guildId);
    if (!guild?.icon) return null;
    return IconUtils.getGuildIconURL({ id: guild.id, icon: guild.icon, size: 32 }) ?? null;
}

function GuildIcon({ guildId, name }: { guildId: string; name: string; }) {
    const iconUrl = getGuildIconUrl(guildId);
    if (iconUrl) return <img className={cl("guild-icon")} src={iconUrl} alt={name} />;
    return <div className={cl("guild-icon-fallback")}>{name.charAt(0).toUpperCase()}</div>;
}

function UserAvatar({ userId, guildId }: { userId: string; guildId?: string; }) {
    const user = UserStore.getUser(userId);
    const src = user
        ? user.getAvatarURL(guildId, 32)
        : IconUtils.getDefaultAvatarURL(userId);
    const name = user?.globalName ?? user?.username ?? "Unknown user";

    return (
        <Tooltip text={name}>
            {tooltipProps => (
                <img
                    {...tooltipProps}
                    className={cl("avatar")}
                    src={src}
                    alt={name}
                    onClick={() => openUserProfile(userId)}
                />
            )}
        </Tooltip>
    );
}

function seedExistingUsers() {
    if (!currentChannelId) return;
    const states = VoiceStateStore.getVoiceStatesForChannel(currentChannelId);
    const myId = UserStore.getCurrentUser()?.id;
    const now = Date.now();

    for (const userId of Object.keys(states)) {
        if (userId === myId) continue;
        if (!currentVoiceUsers.has(userId)) {
            currentVoiceUsers.set(userId, now);
        }
    }
}

interface GuildRow {
    guildId: string;
    name: string;
    totalMs: number;
}

interface ChannelRow {
    channelId: string;
    guildId: string;
    guildName: string;
    channelName: string;
    totalMs: number;
}

interface UserChannelRow {
    userId: string;
    channelId: string;
    totalMs: number;
}

interface FriendRow {
    userId: string;
    totalMs: number;
}

function getServerStats(): GuildRow[] {
    const guildTotals = new Map<string, number>();

    for (const [channelId, ms] of Object.entries(channelTimeData)) {
        const channel = ChannelStore.getChannel(channelId);
        const guildId = channel?.guild_id ?? "unknown";
        guildTotals.set(guildId, (guildTotals.get(guildId) ?? 0) + ms);
    }

    const rows: GuildRow[] = [];
    for (const [guildId, totalMs] of guildTotals) {
        const guild = GuildStore.getGuild(guildId);
        rows.push({ guildId, name: guild?.name ?? "Unknown Server", totalMs });
    }

    return rows.sort((a, b) => b.totalMs - a.totalMs);
}

function getChannelStats(): ChannelRow[] {
    const rows: ChannelRow[] = [];

    for (const [channelId, ms] of Object.entries(channelTimeData)) {
        const channel = ChannelStore.getChannel(channelId);
        const guild = channel?.guild_id ? GuildStore.getGuild(channel.guild_id) : null;
        rows.push({
            channelId,
            guildId: channel?.guild_id ?? "unknown",
            guildName: guild?.name ?? "Unknown Server",
            channelName: channel?.name ?? "Unknown Channel",
            totalMs: ms,
        });
    }

    return rows.sort((a, b) => b.totalMs - a.totalMs);
}

function getUserStats(): Map<string, UserChannelRow[]> {
    const byChannel = new Map<string, UserChannelRow[]>();

    for (const [key, ms] of Object.entries(userTimeData)) {
        const separatorIdx = key.indexOf(":");
        const userId = key.slice(0, separatorIdx);
        const channelId = key.slice(separatorIdx + 1);

        const existing = byChannel.get(channelId) ?? [];
        existing.push({ userId, channelId, totalMs: ms });
        byChannel.set(channelId, existing);
    }

    for (const users of byChannel.values()) {
        users.sort((a, b) => b.totalMs - a.totalMs);
    }

    return byChannel;
}

function getTotalTime(): number {
    let total = 0;
    for (const ms of Object.values(channelTimeData)) total += ms;
    return total;
}

function getTotalMessages(): number {
    let total = 0;
    for (const count of Object.values(messageCountData)) total += count;
    return total;
}

function getFriendsStats(): FriendRow[] {
    const friendIds: string[] = RelationshipStore.getFriendIDs();
    const friendSet = new Set(friendIds);
    const totals = new Map<string, number>();

    for (const [key, ms] of Object.entries(userTimeData)) {
        const separatorIdx = key.indexOf(":");
        const userId = key.slice(0, separatorIdx);
        if (!friendSet.has(userId)) continue;
        totals.set(userId, (totals.get(userId) ?? 0) + ms);
    }

    const rows: FriendRow[] = [];
    for (const [userId, totalMs] of totals) {
        rows.push({ userId, totalMs });
    }

    return rows.sort((a, b) => b.totalMs - a.totalMs);
}

function ServerTab({ stats }: { stats: GuildRow[]; }) {
    if (stats.length === 0) return <div className={cl("empty")}>No voice time recorded yet.</div>;

    return (
        <>
            {stats.map(row => (
                <div key={row.guildId} className={cl("row")}>
                    <div className={cl("row-left")}>
                        <GuildIcon guildId={row.guildId} name={row.name} />
                        <div className={cl("row-info")}>
                            <div className={cl("row-name")}>{row.name}</div>
                        </div>
                    </div>
                    <div className={cl("row-stats")}>
                        <span className={cl("row-time")}>{formatDuration(row.totalMs)}</span>
                        <span className={cl("row-messages")}>{(messageCountData[row.guildId] ?? 0).toLocaleString()} messages</span>
                    </div>
                </div>
            ))}
        </>
    );
}

function ChannelTab({ stats }: { stats: ChannelRow[]; }) {
    if (stats.length === 0) return <div className={cl("empty")}>No voice time recorded yet.</div>;

    return (
        <>
            {stats.map(row => (
                <div key={row.channelId} className={cl("row")}>
                    <div className={cl("row-left")}>
                        <GuildIcon guildId={row.guildId} name={row.guildName} />
                        <div className={cl("row-info")}>
                            <div className={cl("row-name")}>{row.channelName}</div>
                            <Text variant="text-xs/normal" style={{ color: "var(--text-muted)" }}>{row.guildName}</Text>
                        </div>
                    </div>
                    <span className={cl("row-time")}>{formatDuration(row.totalMs)}</span>
                </div>
            ))}
        </>
    );
}

function UsersTab({ channelStats, userStats }: { channelStats: ChannelRow[]; userStats: Map<string, UserChannelRow[]>; }) {
    if (channelStats.length === 0) return <div className={cl("empty")}>No voice time recorded yet.</div>;

    return (
        <>
            {channelStats.map(ch => {
                const users = userStats.get(ch.channelId) ?? [];
                return (
                    <div key={ch.channelId} className={cl("channel-section")}>
                        <div className={cl("channel-header")}>
                            <GuildIcon guildId={ch.guildId} name={ch.guildName} />
                            <div className={cl("channel-header-info")}>
                                <div className={cl("channel-name")}>{ch.channelName}</div>
                                <Text variant="text-xs/normal" style={{ color: "var(--text-muted)" }}>
                                    {ch.guildName} &middot; {formatDuration(ch.totalMs)}
                                </Text>
                            </div>
                        </div>
                        {users.length === 0
                            ? <div className={cl("no-users")}>No users tracked in this channel.</div>
                            : users.map(u => {
                                const user = UserStore.getUser(u.userId);
                                const username = user?.globalName ?? user?.username ?? "Unknown";
                                return (
                                    <div key={u.userId} className={cl("user-row")}>
                                        <UserAvatar userId={u.userId} guildId={ch.guildId} />
                                        <div className={cl("user-content")}>
                                            <span
                                                className={cl("user-name")}
                                                onClick={() => openUserProfile(u.userId)}
                                            >
                                                {username}
                                            </span>
                                            <span className={cl("user-description")}>Time spent together</span>
                                        </div>
                                        <span className={cl("user-time")}>{formatDuration(u.totalMs)}</span>
                                    </div>
                                );
                            })
                        }
                    </div>
                );
            })}
        </>
    );
}

function FriendsTab({ stats }: { stats: FriendRow[]; }) {
    if (stats.length === 0) return <div className={cl("empty")}>No friend voice time recorded yet.</div>;

    return (
        <>
            {stats.map(row => {
                const user = UserStore.getUser(row.userId);
                const username = user?.globalName ?? user?.username ?? "Unknown";
                return (
                    <div key={row.userId} className={cl("user-row", "friend-row")}>
                        <UserAvatar userId={row.userId} />
                        <div className={cl("user-content")}>
                            <span
                                className={cl("user-name")}
                                onClick={() => openUserProfile(row.userId)}
                            >
                                {username}
                            </span>
                            <span className={cl("user-description")}>Total time in voice together</span>
                        </div>
                        <span className={cl("user-time")}>{formatDuration(row.totalMs)}</span>
                    </div>
                );
            })}
        </>
    );
}

function VoiceTimeModal({ modalProps }: { modalProps: ModalProps; }) {
    const [tab, setTab] = useState<string>("servers");
    const [, forceUpdate] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            flushCurrentSession();
            forceUpdate(n => n + 1);
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    const serverStats = getServerStats();
    const channelStats = getChannelStats();
    const userStats = getUserStats();
    const friendsStats = getFriendsStats();
    const totalTime = getTotalTime();

    return (
        <ModalRoot {...modalProps} size={ModalSize.MEDIUM}>
            <ModalHeader className={cl("head")}>
                <Text variant="heading-lg/semibold" style={{ flexGrow: 1 }}>Voice Time Tracker</Text>
                <ModalCloseButton onClick={modalProps.onClose} />
            </ModalHeader>

            <div className={cl("sticky")}>
                <div className={cl("top-bar")}>
                    <div className={cl("total")}>
                        <div className={cl("total-item")}>
                            <span className={cl("total-label")}>Total Voice Time</span>
                            <span className={cl("total-value")}>{formatDuration(totalTime)}</span>
                        </div>
                        <div className={cl("total-item")}>
                            <span className={cl("total-label")}>Total Messages</span>
                            <span className={cl("total-value")}>{getTotalMessages().toLocaleString()}</span>
                        </div>
                    </div>
                    <Button
                        color={Button.Colors.RED}
                        size={Button.Sizes.SMALL}
                        onClick={() => {
                            channelTimeData = {};
                            userTimeData = {};
                            messageCountData = {};
                            save();
                            forceUpdate(n => n + 1);
                        }}
                    >
                        Clear data
                    </Button>
                </div>

                <TabBar
                    type="top"
                    look="brand"
                    className={classes("vc-settings-tab-bar", cl("tab-bar"))}
                    selectedItem={tab}
                    onItemSelect={setTab}
                >
                    <TabBar.Item className="vc-settings-tab-bar-item" id="servers">
                        By Server
                    </TabBar.Item>
                    <TabBar.Item className="vc-settings-tab-bar-item" id="channels">
                        By Channel
                    </TabBar.Item>
                    <TabBar.Item className="vc-settings-tab-bar-item" id="users">
                        Users
                    </TabBar.Item>
                    <TabBar.Item className="vc-settings-tab-bar-item" id="friends">
                        Friends
                    </TabBar.Item>
                </TabBar>
            </div>

            <ModalContent className={cl("contents")}>
                {tab === "servers" && <ServerTab stats={serverStats} />}
                {tab === "channels" && <ChannelTab stats={channelStats} />}
                {tab === "users" && <UsersTab channelStats={channelStats} userStats={userStats} />}
                {tab === "friends" && <FriendsTab stats={friendsStats} />}
            </ModalContent>
        </ModalRoot>
    );
}

function VoiceTimeIcon({ className }: { className?: string; }) {
    return (
        <svg
            className={className}
            viewBox="0 0 24 24"
            width={24}
            height={24}
            fill="currentColor"
        >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z" />
        </svg>
    );
}

function ToolBarButton() {
    return (
        <HeaderBarButton
            tooltip="Voice Time Tracker"
            icon={VoiceTimeIcon}
            onClick={() => openModal(props => <VoiceTimeModal modalProps={props} />)}
        />
    );
}

export default definePlugin({
    name: "VoiceTimeTracker",
    description: "Track how much time you spend in voice channels. Shows stats broken down by server, channel, and the people you talk to most.",
    tags: ["Voice", "Utility"],
    authors: [EquicordDevs.NOobzy],

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
        const storedChannels = await DataStore.get<Record<string, number>>(CHANNEL_STORE_KEY);
        if (storedChannels) channelTimeData = storedChannels;

        const storedUsers = await DataStore.get<typeof userTimeData>(USER_STORE_KEY);
        if (storedUsers) userTimeData = storedUsers;

        const storedMessages = await DataStore.get<Record<string, number>>(MESSAGES_STORE_KEY);
        if (storedMessages) messageCountData = storedMessages;

        const voiceChannelId = SelectedChannelStore.getVoiceChannelId();
        if (voiceChannelId) {
            currentChannelId = voiceChannelId;
            joinTimestamp = Date.now();
            seedExistingUsers();
        }
    },

    stop() {
        flushCurrentSession();
        joinTimestamp = null;
        currentChannelId = null;
        currentVoiceUsers.clear();
    },

    flux: {
        MESSAGE_CREATE({ message, optimistic }: { message: { author: { id: string; }; channel_id: string; }; optimistic?: boolean; }) {
            if (optimistic) return;
            const currentUser = UserStore.getCurrentUser();
            if (!currentUser || message.author?.id !== currentUser.id) return;

            const channel = ChannelStore.getChannel(message.channel_id);
            if (!channel?.guild_id) return;

            messageCountData[channel.guild_id] = (messageCountData[channel.guild_id] ?? 0) + 1;
            DataStore.set(MESSAGES_STORE_KEY, messageCountData).catch(e => logger.error("Failed to save message count", e));
        },

        VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceState[]; }) {
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
                            joinTimestamp = Date.now();
                            currentChannelId = state.channelId;
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
                        joinTimestamp = null;
                        currentChannelId = null;
                        currentVoiceUsers.clear();
                    }
                    continue;
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
