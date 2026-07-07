/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { HeaderBarButton } from "@api/HeaderBar";
import { Button } from "@components/Button";
import ErrorBoundary from "@components/ErrorBoundary";
import { Flex } from "@components/Flex";
import { Heading } from "@components/Heading";
import { UserIcon } from "@components/Icons";
import { Margins } from "@components/margins";
import { Paragraph } from "@components/Paragraph";
import { classNameFactory } from "@utils/css";
import { openPrivateChannel, openUserProfile } from "@utils/discord";
import { classes } from "@utils/misc";
import { PluginSettingComponentProps } from "@utils/types";
import { RenderModalProps } from "@vencord/discord-types";
import { Avatar, Forms, IconUtils, Modal, openModal, React, RelationshipStore, SearchableSelect, Select, Tooltip, UserStore, useStateFromStores } from "@webpack/common";

import { compareEntries, formatExactDate, formatLeaderboardValue, formatYears, getCacheKey, getFriendEntries, getFriendshipRankBadge, getLeaderboardRank, getLeaderboardTooltip, getMessageCount, isFriendTracked, loadMessageCountsForEntries, cancelMessageCountBatch, MessageCountState, useMessageCountStore } from "./data";
import { settings } from "./settings";
import { FriendshipRankBadge, LEADERBOARD_SETTINGS_KEYS, LeaderboardEntry, MessageCountModes, SORT_MODE_LABELS, SortMode, SortModes } from "./types";

type PodiumPlace = 1 | 2 | 3;
type PodiumCardProps = Readonly<{ entry: LeaderboardEntry | undefined; place: PodiumPlace; rank: number; sortMode: SortMode; }>;
type PodiumCardWithActionProps = PodiumCardProps & Readonly<{ onClick?: () => void; }>;
type PodiumStandProps = Readonly<{ place: PodiumPlace; rank: number; friendshipDays?: number; }>;

const cl = classNameFactory("vc-friendship-leaderboard-");
const EMPTY_MESSAGE_COUNTS: Record<string, number> = {};
const MESSAGE_COUNT_MODE_KEYS: ["messageCountMode"] = ["messageCountMode"];

function areFriendEntriesEqual(prev: LeaderboardEntry[], next: LeaderboardEntry[]) {
    if (prev.length !== next.length) return false;

    return prev.every((entry, index) => {
        const other = next[index];
        return other?.id === entry.id
            && other.name === entry.name
            && other.friendshipDays === entry.friendshipDays;
    });
}

function areFriendOptionsEqual(prev: { label: string; value: string; }[], next: { label: string; value: string; }[]) {
    if (prev.length !== next.length) return false;
    return prev.every((option, index) => option.value === next[index]?.value && option.label === next[index]?.label);
}

export function openRankModal(rank: FriendshipRankBadge) {
    openModal((props: RenderModalProps) => (
        <ErrorBoundary>
            <Modal
                {...props}
                size="sm"
                title={
                    <Flex className={cl("rank-modal-flex")}>
                        <Forms.FormTitle className={cl("rank-modal-img")} tag="h2">
                            <img src={rank.iconSrc} alt="rank icon" />
                            {rank.title}
                        </Forms.FormTitle>
                    </Flex>
                }
            >
                <div className={cl("rank-modal-text")}>
                    <Paragraph>{rank.description}</Paragraph>
                </div>
            </Modal>
        </ErrorBoundary>
    ));
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
    const { messageCountMode } = settings.use(MESSAGE_COUNT_MODE_KEYS);
    const cacheKey = getCacheKey(entry.id, messageCountMode);
    const messageCount = useMessageCountStore((state: MessageCountState) => state.counts[cacheKey]);
    const loading = messageCount == null;

    React.useEffect(() => {
        if (messageCount != null) return;
        void getMessageCount(entry.id, messageCountMode);
    }, [cacheKey, entry.id, messageCountMode, messageCount]);

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
    const { sortDescending, sortMode, messageCountMode, trackedFriendIds } = settings.use(LEADERBOARD_SETTINGS_KEYS);

    const friendEntries = useStateFromStores(
        [RelationshipStore, UserStore],
        () => getFriendEntries(messageCountMode),
        [messageCountMode],
        areFriendEntriesEqual
    );

    const messageSearchEntries = React.useMemo(() => {
        if (sortMode !== SortModes.MESSAGES) return friendEntries;
        return friendEntries.filter(entry => isFriendTracked(entry.id, trackedFriendIds));
    }, [friendEntries, sortMode, trackedFriendIds]);

    const messageCounts = useMessageCountStore((state: MessageCountState) =>
        sortMode === SortModes.MESSAGES ? state.counts : EMPTY_MESSAGE_COUNTS
    );
    const isLoadingMessageCounts = useMessageCountStore((state: MessageCountState) => state.isLoadingCounts);
    const pendingMessageCounts = useMessageCountStore((state: MessageCountState) => state.pendingCount);
    const currentCheckingFriend = useMessageCountStore((state: MessageCountState) => state.currentChecking);

    React.useEffect(() => {
        if (sortMode !== SortModes.MESSAGES) return;
        void loadMessageCountsForEntries(messageSearchEntries, messageCountMode);
        return () => cancelMessageCountBatch();
    }, [messageSearchEntries, messageCountMode, sortMode]);

    const leaderboard = React.useMemo(() => {
        return messageSearchEntries
            .map(entry => ({ ...entry, messageCount: messageCounts[getCacheKey(entry.id, messageCountMode)] }))
            .sort((a, b) => compareEntries(a, b, sortDescending, sortMode));
    }, [messageSearchEntries, messageCountMode, messageCounts, sortDescending, sortMode]);

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
                    <div className={classes(cl("select-wrapper"), Margins.bottom16)}>
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

export function FriendTrackingSetting({ setValue }: PluginSettingComponentProps) {
    const [trackedFriendIds, setTrackedFriendIds] = React.useState<string[]>(settings.store.trackedFriendIds ?? []);

    const options = useStateFromStores([RelationshipStore, UserStore], () =>
        RelationshipStore.getFriendIDs().map(id => {
            const user = UserStore.getUser(id);
            return { label: user ? (user.globalName || user.username) : id, value: id };
        }),
        undefined,
        areFriendOptionsEqual
    );

    return (
        <div>
            <Heading tag="h5">Friends included in message search</Heading>
            <Paragraph className={Margins.bottom8}>
                Leave empty to include all friends.
            </Paragraph>
            <SearchableSelect
                options={options}
                value={trackedFriendIds}
                onChange={(value: unknown) => {
                    const ids = Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
                    setTrackedFriendIds(ids);
                    setValue(ids);
                }}
                closeOnSelect={false}
                placeholder="All friends included"
                multi
                renderOptionPrefix={option => {
                    const user = UserStore.getUser(String(option.value));
                    if (!user) return null;

                    return (
                        <img
                            className={cl("option-avatar")}
                            src={IconUtils.getUserAvatarURL(user, false, 24)}
                            width={24}
                            height={24}
                        />
                    );
                }}
            />
        </div>
    );
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
