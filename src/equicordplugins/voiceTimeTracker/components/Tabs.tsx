/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { openUserProfile } from "@utils/discord";
import { IconUtils, Text, Tooltip, UserStore } from "@webpack/common";

import { cl, formatDuration, getGuildIconUrl, messageCountData } from "../store";
import { ChannelRow, FriendRow, GuildRow, UserChannelRow } from "../types";

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

export function ServerTab({ stats }: { stats: GuildRow[]; }) {
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

export function ChannelTab({ stats }: { stats: ChannelRow[]; }) {
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

export function UsersTab({ channelStats, userStats }: { channelStats: ChannelRow[]; userStats: Map<string, UserChannelRow[]>; }) {
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

export function FriendsTab({ stats }: { stats: FriendRow[]; }) {
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
