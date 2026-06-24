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
import { Avatar, Modal, openModal, React, RelationshipStore, Tooltip, UserStore, useStateFromStores } from "@webpack/common";

import {
    compareEntries,
    formatExactDate,
    formatLeaderboardValue,
    formatYears,
    getFriendEntries,
    getFriendshipRankBadge,
    getLeaderboardRank,
    getLeaderboardTooltip,
    getSentMessageCount,
    messageCountCache
} from "./data";
import { settings } from "./settings";
import { LEADERBOARD_SETTINGS_KEYS, LeaderboardEntry, SORT_MODE_LABELS, SortMode, SortModes } from "./types";

type PodiumPlace = 1 | 2 | 3;
type PodiumCardProps = Readonly<{ entry: LeaderboardEntry | undefined; place: PodiumPlace; rank: number; sortMode: SortMode; }>;
type PodiumCardWithActionProps = PodiumCardProps & Readonly<{ onClick?: () => void; }>;
type PodiumStandProps = Readonly<{ place: PodiumPlace; rank: number; friendshipDays?: number; }>;

const cl = classNameFactory("vc-friendship-leaderboard-");

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
    const [messageCount, setMessageCount] = React.useState(messageCountCache[entry.id] ?? 0);
    const [loading, setLoading] = React.useState(messageCountCache[entry.id] == null);

    React.useEffect(() => {
        let cancelled = false;

        getSentMessageCount(entry.id).then(count => {
            if (cancelled) return;
            setMessageCount(count);
            setLoading(false);
        });

        return () => { cancelled = true; };
    }, [entry.id]);

    const closeModal = React.useCallback(() => modalProps.onClose(), [modalProps]);
    const badge = getFriendshipRankBadge(entry.friendshipDays);

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
                            <span className={cl("stats-label")}>Messages Sent:</span>
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
    const { sortDescending, sortMode } = settings.use(LEADERBOARD_SETTINGS_KEYS);

    const friendEntries = useStateFromStores(
        [RelationshipStore, UserStore],
        () => getFriendEntries(),
        []
    );

    const [messageCounts, setMessageCounts] = React.useState<Record<string, number>>({});
    const [isLoadingMessageCounts, setIsLoadingMessageCounts] = React.useState(false);
    const [pendingMessageCounts, setPendingMessageCounts] = React.useState(0);

    React.useEffect(() => {
        if (sortMode !== SortModes.MESSAGES) return;

        let cancelled = false;

        const loadMissingCounts = async () => {
            const missing = friendEntries.filter(entry => messageCountCache[entry.id] == null);

            if (!missing.length) {
                if (!cancelled) {
                    setMessageCounts({ ...messageCountCache });
                    setIsLoadingMessageCounts(false);
                    setPendingMessageCounts(0);
                }
                return;
            }

            if (!cancelled) {
                setIsLoadingMessageCounts(true);
                setPendingMessageCounts(missing.length);
            }

            const queue = [...missing];
            const workerCount = Math.min(3, queue.length);

            const loadWorker = async () => {
                for (; ;) {
                    const entry = queue.shift();
                    if (!entry || cancelled) return;
                    await getSentMessageCount(entry.id);
                    if (cancelled) return;
                    setPendingMessageCounts(prev => Math.max(0, prev - 1));
                }
            };

            await Promise.all(Array.from({ length: workerCount }, () => loadWorker()));

            if (cancelled) return;
            setMessageCounts({ ...messageCountCache });
            setIsLoadingMessageCounts(false);
        };

        void loadMissingCounts();

        return () => { cancelled = true; };
    }, [friendEntries, sortMode]);

    const leaderboard = React.useMemo(() => {
        return friendEntries
            .map(entry => ({ ...entry, messageCount: messageCounts[entry.id] ?? messageCountCache[entry.id] }))
            .sort((a, b) => compareEntries(a, b, sortDescending, sortMode));
    }, [friendEntries, messageCounts, sortDescending, sortMode]);

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
                        <div className={cl("loading")}>Loading message counts... {pendingMessageCounts} left.</div>
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
