/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { HeaderBarButton } from "@api/HeaderBar";
import { Button } from "@components/Button";
import { UserIcon } from "@components/Icons";
import { classNameFactory } from "@utils/css";
import { openPrivateChannel, openUserProfile } from "@utils/discord";
import { RenderModalProps } from "@vencord/discord-types";
import { Avatar, Modal, openModal, React, RelationshipStore, Select, Tooltip, UserStore, useStateFromStores } from "@webpack/common";

import {
    compareEntries,
    formatExactDate,
    formatLeaderboardValue,
    formatYears,
    getCacheKey,
    getFriendEntries,
    getFriendshipRankBadge,
    getLeaderboardRank,
    getLeaderboardTooltip,
    getMessageCount,
    loadMessageCountsForEntries,
    messageCountCache
} from "./data";
import { settings } from "./settings";
import { LEADERBOARD_SETTINGS_KEYS, LeaderboardEntry, MessageCountMode, MessageCountModes, SORT_MODE_LABELS, SortMode, SortModes } from "./types";

type PodiumPlace = 1 | 2 | 3;
type PodiumCardProps = Readonly<{ entry: LeaderboardEntry | undefined; place: PodiumPlace; rank: number; sortMode: SortMode; }>;
type PodiumCardWithActionProps = PodiumCardProps & Readonly<{ onClick?: () => void; }>;
type PodiumStandProps = Readonly<{ place: PodiumPlace; rank: number; friendshipDays?: number; }>;

const cl = classNameFactory("vc-friendship-leaderboard-");

function areFriendEntriesEqual(prev: LeaderboardEntry[], next: LeaderboardEntry[]) {
    if (prev.length !== next.length) return false;

    return prev.every((entry, index) => {
        const other = next[index];
        return other?.id === entry.id
            && other.name === entry.name
            && other.friendshipDays === entry.friendshipDays;
    });
}

function FriendshipRankBadgeIcon({ friendshipDays }: Readonly<{ friendshipDays?: number; }>) {
    if (friendshipDays == null) return null;
    const badge = getFriendshipRankBadge(friendshipDays);
    if (!badge) return null;

    return (
        <Tooltip text={badge.title}>
            {tooltipProps => (
                <img
                    {...tooltipProps}
                    className={cl("rank-badge")}
                    src={badge.iconSrc}
                    alt={`${badge.title} friendship rank badge`}
                />
            )}
        </Tooltip>
    );
}

function PodiumCard({ entry, place, rank, onClick, sortMode }: PodiumCardWithActionProps) {
    if (!entry) {
        return (
            <div className={cl("podium-card", `podium-${place}`)}>
                {place === 1 ? <div className={cl("podium-crown")} aria-hidden="true">👑</div> : null}
                <div className={cl("avatar-placeholder")} />
                <div className={cl("podium-name")}>Empty</div>
                <div className={cl("podium-value")}>-</div>
            </div>
        );
    }

    return (
        <Button
            className={cl("podium-card", `podium-${place}`, "podium-clickable")}
            onClick={onClick}
            variant="none"
            aria-label={`Open stats of ${entry.name}. Rank ${rank}. Friendship ${formatYears(entry.friendshipYears)}.`}
        >
            {place === 1 ? <div className={cl("podium-crown")} aria-hidden="true">👑</div> : null}
            <Avatar className={cl("podium-avatar")} src={entry.avatarUrl} size="SIZE_56" aria-label={entry.name} />
            <div className={cl("podium-name")}>{entry.name}</div>
            <Tooltip text={getLeaderboardTooltip(entry, sortMode)}>
                {tooltipProps => (
                    <div className={cl("podium-value")} {...tooltipProps}>
                        {formatLeaderboardValue(entry, sortMode)}
                    </div>
                )}
            </Tooltip>
        </Button>
    );
}

function PodiumStand({ place, rank, friendshipDays }: PodiumStandProps) {
    return (
        <div className={cl("podium-stand", `podium-stand-${place}`)} aria-hidden="true">
            <span className={cl("podium-stand-rank")}>
                <FriendshipRankBadgeIcon friendshipDays={friendshipDays} />
                #{rank}
            </span>
        </div>
    );
}

function FriendStatsModal({ entry, modalProps }: Readonly<{ entry: LeaderboardEntry; modalProps: RenderModalProps; }>) {
    const { messageCountMode } = settings.use(["messageCountMode"]);
    const cacheKey = getCacheKey(entry.id, messageCountMode);
    const [messageCount, setMessageCount] = React.useState(messageCountCache[cacheKey] ?? 0);
    const [loading, setLoading] = React.useState(messageCountCache[cacheKey] == null);

    React.useEffect(() => {
        let cancelled = false;
        const currentCount = messageCountCache[cacheKey] ?? 0;
        setMessageCount(currentCount);
        setLoading(messageCountCache[cacheKey] == null);

        if (messageCountCache[cacheKey] == null) {
            getMessageCount(entry.id, messageCountMode).then(count => {
                if (cancelled) return;
                setMessageCount(count);
                setLoading(false);
            });
        }

        return () => { cancelled = true; };
    }, [cacheKey, entry.id, messageCountMode]);

    const closeModal = React.useCallback(() => modalProps.onClose(), [modalProps]);
    const badge = getFriendshipRankBadge(entry.friendshipDays);
    let messageCountLabel = "All Messages";
    if (messageCountMode === MessageCountModes.SENT) {
        messageCountLabel = "Messages Sent";
    } else if (messageCountMode === MessageCountModes.RECEIVED) {
        messageCountLabel = "Messages Received";
    }

    return (
        <Modal {...modalProps} size="md" title={`${entry.name}'s Stats`}>
            <div className={cl("stats-container")}>
                <div className={cl("stats-content")}>
                    <div className={cl("stats-avatar")}>
                        <Avatar src={entry.avatarUrl} size="SIZE_120" aria-label={entry.name} />
                    </div>

                    <div className={cl("stats-info")}>
                        <div className={cl("stats-row")}>
                            <span className={cl("stats-label")}>Friendship Duration:</span>
                            <span className={cl("stats-value")}>{formatYears(entry.friendshipYears)}</span>
                        </div>

                        <div className={cl("stats-row")}>
                            <span className={cl("stats-label")}>{messageCountLabel}:</span>
                            <span className={cl("stats-value")}>{loading ? "Loading..." : messageCount}</span>
                        </div>

                        {badge && (
                            <div className={cl("stats-row")}>
                                <span className={cl("stats-label")}>Rank:</span>
                                <span className={cl("stats-value")}>
                                    <FriendshipRankBadgeIcon friendshipDays={entry.friendshipDays} />
                                    {badge.title}
                                </span>
                            </div>
                        )}

                        {entry.friendshipSince && (
                            <div className={cl("stats-row")}>
                                <span className={cl("stats-label")}>Friends Since:</span>
                                <span className={cl("stats-value")}>{formatExactDate(entry.friendshipSince)}</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className={cl("stats-actions")}>
                    <Button onClick={() => { openUserProfile(entry.id); closeModal(); }} color="brand">
                        View Profile
                    </Button>
                    <Button onClick={() => { openPrivateChannel(entry.id, true); closeModal(); }} color="brand">
                        Open Chat
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

function openFriendStatsModal(entry: LeaderboardEntry) {
    openModal(modalProps => <FriendStatsModal entry={entry} modalProps={modalProps} />);
}

function getMessageCountValue(entry: LeaderboardEntry, mode: MessageCountMode): number {
    return messageCountCache[getCacheKey(entry.id, mode)] ?? 0;
}

function getMessageCountMap(entries: readonly LeaderboardEntry[], mode: MessageCountMode): Record<string, number> {
    return Object.fromEntries(entries.map(entry => [entry.id, getMessageCountValue(entry, mode)]));
}

function mergeMessageCountState(prev: Record<string, number>, next: Record<string, number>): Record<string, number> {
    return { ...prev, ...next };
}

function applyMessageCountProgress(
    setMessageCounts: React.Dispatch<React.SetStateAction<Record<string, number>>>,
    entry: LeaderboardEntry,
    messageCountMode: MessageCountMode
) {
    setMessageCounts(prev => mergeMessageCountState(prev, { [entry.id]: getMessageCountValue(entry, messageCountMode) }));
}

export function OpenLeaderboardButton() {
    return (
        <HeaderBarButton
            className={cl("topbar-btn")}
            onClick={openLeaderboardModal}
            tooltip="Open Friendship Leaderboard"
            icon={UserIcon}
        />
    );
}

function LeaderboardModal({ modalProps }: Readonly<{ modalProps: RenderModalProps; }>) {
    const { sortDescending, sortMode, messageCountMode } = settings.use(LEADERBOARD_SETTINGS_KEYS);

    const friendEntries = useStateFromStores(
        [RelationshipStore, UserStore],
        () => getFriendEntries(messageCountMode),
        [messageCountMode],
        areFriendEntriesEqual
    );

    const [messageCounts, setMessageCounts] = React.useState<Record<string, number>>({});
    const [isLoadingMessageCounts, setIsLoadingMessageCounts] = React.useState(false);
    const [pendingMessageCounts, setPendingMessageCounts] = React.useState(0);
    const [currentCheckingFriend, setCurrentCheckingFriend] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (sortMode !== SortModes.MESSAGES) return;

        setMessageCounts({});

        let cancelled = false;

        const loadMissingCounts = async () => {
            const missing = friendEntries.filter(entry => messageCountCache[getCacheKey(entry.id, messageCountMode)] == null);

            if (!missing.length) {
                if (!cancelled) {
                    setIsLoadingMessageCounts(false);
                    setPendingMessageCounts(0);
                    setCurrentCheckingFriend(null);
                }
                return;
            }

            if (!cancelled) {
                setIsLoadingMessageCounts(true);
                setPendingMessageCounts(missing.length);
                setCurrentCheckingFriend(null);
            }

            await loadMessageCountsForEntries(missing, (entry, remaining) => {
                if (cancelled) return;
                setCurrentCheckingFriend(entry.name);
                setPendingMessageCounts(remaining);
                applyMessageCountProgress(setMessageCounts, entry, messageCountMode);
            }, messageCountMode);

            if (cancelled) return;
            setCurrentCheckingFriend(null);
            setMessageCounts(prev => mergeMessageCountState(prev, getMessageCountMap(friendEntries, messageCountMode)));
            setIsLoadingMessageCounts(false);
        };

        void loadMissingCounts();

        return () => { cancelled = true; };
    }, [friendEntries, messageCountMode, sortMode]);

    const leaderboard = React.useMemo(() => {
        return friendEntries
            .map(entry => ({ ...entry, messageCount: messageCounts[entry.id] ?? messageCountCache[getCacheKey(entry.id, messageCountMode)] }))
            .sort((a, b) => compareEntries(a, b, sortDescending, sortMode));
    }, [friendEntries, messageCountMode, messageCounts, sortDescending, sortMode]);

    const totalEntries = leaderboard.length;

    return (
        <Modal
            {...modalProps}
            size="lg"
            title="Friendship Leaderboard"
            actions={[
                {
                    text: SORT_MODE_LABELS[SortModes.FRIENDSHIP],
                    variant: sortMode === SortModes.FRIENDSHIP ? "primary" : "secondary",
                    onClick: () => { settings.store.sortMode = SortModes.FRIENDSHIP; }
                },
                {
                    text: SORT_MODE_LABELS[SortModes.MESSAGES],
                    variant: sortMode === SortModes.MESSAGES ? "primary" : "secondary",
                    onClick: () => { settings.store.sortMode = SortModes.MESSAGES; }
                },
                {
                    text: sortDescending ? "↑ Most to least" : "↓ Least to most",
                    variant: "secondary",
                    onClick: () => { settings.store.sortDescending = !sortDescending; }
                }
            ]}
        >
            <div className={cl("container")}>
                {sortMode === SortModes.MESSAGES && (
                    <div style={{ marginBottom: 16 }}>
                        <Select
                            options={[
                                { label: "Sent messages", value: MessageCountModes.SENT },
                                { label: "Received messages", value: MessageCountModes.RECEIVED },
                                { label: "All messages", value: MessageCountModes.ALL }
                            ]}
                            select={value => { settings.store.messageCountMode = value; }}
                            isSelected={value => value === messageCountMode}
                            serialize={String}
                        />
                    </div>
                )}

                <div className={cl("podium")}>
                    <div className={cl("podium-slot", "podium-slot-2")}>
                        <PodiumCard place={2} rank={getLeaderboardRank(1, totalEntries, sortDescending)} entry={leaderboard[1]} sortMode={sortMode} onClick={() => leaderboard[1] && openFriendStatsModal(leaderboard[1])} />
                        <PodiumStand place={2} rank={getLeaderboardRank(1, totalEntries, sortDescending)} friendshipDays={leaderboard[1]?.friendshipDays} />
                    </div>
                    <div className={cl("podium-slot", "podium-slot-1")}>
                        <PodiumCard place={1} rank={getLeaderboardRank(0, totalEntries, sortDescending)} entry={leaderboard[0]} sortMode={sortMode} onClick={() => leaderboard[0] && openFriendStatsModal(leaderboard[0])} />
                        <PodiumStand place={1} rank={getLeaderboardRank(0, totalEntries, sortDescending)} friendshipDays={leaderboard[0]?.friendshipDays} />
                    </div>
                    <div className={cl("podium-slot", "podium-slot-3")}>
                        <PodiumCard place={3} rank={getLeaderboardRank(2, totalEntries, sortDescending)} entry={leaderboard[2]} sortMode={sortMode} onClick={() => leaderboard[2] && openFriendStatsModal(leaderboard[2])} />
                        <PodiumStand place={3} rank={getLeaderboardRank(2, totalEntries, sortDescending)} friendshipDays={leaderboard[2]?.friendshipDays} />
                    </div>
                </div>

                <div className={cl("summary")}>
                    <span className={cl("summary-place")}>Place</span>
                    <span className={cl("summary-name")}>Name</span>
                    <span className={cl("summary-side")}>
                        {sortMode === SortModes.FRIENDSHIP ? "Friends Since" : "Messages"}
                    </span>
                </div>

                <div className={cl("list")}>
                    {sortMode === SortModes.MESSAGES && isLoadingMessageCounts && (
                        <div className={cl("loading")}>
                            Loading message counts{currentCheckingFriend ? ` for ${currentCheckingFriend}` : ""}... {pendingMessageCounts} left.
                        </div>
                    )}

                    {leaderboard.slice(3).map((entry, index) => (
                        <Button
                            key={entry.id}
                            variant="none"
                            className={cl("row")}
                            onClick={() => openFriendStatsModal(entry)}
                            aria-label={`Open stats of ${entry.name}. Rank ${getLeaderboardRank(index + 3, totalEntries, sortDescending)}.`}
                        >
                            <span className={cl("rank")}>
                                <FriendshipRankBadgeIcon friendshipDays={entry.friendshipDays} />
                                <span>#{getLeaderboardRank(index + 3, totalEntries, sortDescending)}</span>
                            </span>
                            <Avatar className={cl("avatar")} src={entry.avatarUrl} size="SIZE_32" aria-label={entry.name} />
                            <div className={cl("info")}>
                                <div className={cl("name")}>{entry.name}</div>
                            </div>
                            <Tooltip text={getLeaderboardTooltip(entry, sortMode)}>
                                {tooltipProps => (
                                    <span className={cl("score")} {...tooltipProps}>
                                        {formatLeaderboardValue(entry, sortMode)}
                                    </span>
                                )}
                            </Tooltip>
                        </Button>
                    ))}

                    {leaderboard.length === 0 && (
                        <div className={cl("empty")}>You have no friends yet.</div>
                    )}
                </div>
            </div>
        </Modal>
    );
}

export function openLeaderboardModal() {
    openModal(modalProps => <LeaderboardModal modalProps={modalProps} />);
}

export function SettingsAboutComponent() {
    return (
        <div className={cl("about")}>
            <div className={cl("about-title")}>Friendship Leaderboard</div>
            <div className={cl("about-text")}>
                Opens a custom leaderboard modal with a podium for your longest friends.
            </div>
            <Button variant="secondary" onClick={openLeaderboardModal}>
                Open Leaderboard
            </Button>
        </div>
    );
}
