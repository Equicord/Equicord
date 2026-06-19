/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { HeaderBarButton } from "@api/HeaderBar";
import { definePluginSettings } from "@api/Settings";
import { UserIcon } from "@components/Icons";
import { EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { openUserProfile } from "@utils/discord";
import definePlugin, { OptionType } from "@utils/types";
import { RenderModalProps } from "@vencord/discord-types";
import { Modal, openModal, React, RelationshipStore, Tooltip, UserStore } from "@webpack/common";

interface LeaderboardEntry {
    id: string;
    name: string;
    avatarUrl: string;
    friendshipDays: number;
    friendshipSince: string;
    friendshipYears: number;
}

type PodiumPlace = 1 | 2 | 3;
type PodiumCardProps = Readonly<{ entry: LeaderboardEntry | undefined; place: PodiumPlace; rank: number; }>;
type PodiumCardWithActionProps = PodiumCardProps & Readonly<{ onClick?: () => void; }>;
type PodiumStandProps = Readonly<{ place: PodiumPlace; rank: number; }>;

const cl = classNameFactory("vc-friendship-leaderboard-");
const DAYS_PER_YEAR = 365.25; // idc if I am stupid or not but this is the most accurate way to convert days to years without getting into leap seconds and whatnot, and it's close enough for this use case anyway. Correct me if I am wrong :3
const MS_PER_DAY = 1000 * 60 * 60 * 24;

const settings = definePluginSettings({
    sortDescending: {
        type: OptionType.BOOLEAN,
        description: "Show highest ranked friends first",
        default: true
    }
});

function daysSince(dateString?: string | null): number {
    if (!dateString) return 0;

    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return 0;

    const currentDate = new Date();

    const differenceInMs = currentDate.getTime() - date.getTime();
    const days = differenceInMs / MS_PER_DAY;

    return Math.max(0, Math.floor(days));
}

function getFriendshipYears(friendshipDays: number): number {
    return friendshipDays / DAYS_PER_YEAR;
}

function formatExactDate(dateString?: string): string | null {
    if (!dateString) return null;

    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return null;

    return new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(date);
}

function formatFriendshipTooltip(days: number, friendshipSince?: string): string {
    const normalizedDays = Math.max(1, days);
    const dayText = `${normalizedDays} day${normalizedDays === 1 ? "" : "s"}`;
    const exactDate = formatExactDate(friendshipSince);

    return exactDate ? `${dayText} • Since ${exactDate}` : dayText;
}

function getFriendEntries(): LeaderboardEntry[] {
    return RelationshipStore.getFriendIDs()
        .map(friendId => {
            const user = UserStore.getUser(friendId);
            if (!user) return null;

            const friendshipSince = RelationshipStore.getSince(friendId);
            const friendshipDays = daysSince(friendshipSince);
            const friendshipYears = getFriendshipYears(friendshipDays);

            return {
                id: friendId,
                name: RelationshipStore.getNickname(friendId) || user.globalName || user.username,
                avatarUrl: user.getAvatarURL(undefined, 128, true) || "",
                friendshipDays,
                friendshipSince,
                friendshipYears
            } satisfies LeaderboardEntry;
        })
        .filter((entry): entry is LeaderboardEntry => entry !== null);
}

function formatYears(years: number): string {
    if (years < 1) {
        const days = Math.max(1, Math.floor(years * DAYS_PER_YEAR));
        return `${days} day${days === 1 ? "" : "s"}`;
    }

    return `${years.toFixed(1)} years`;
}

function getLeaderboardRank(index: number, total: number, sortDescending: boolean): number {
    return sortDescending ? index + 1 : total - index; // If you reverse the sort order it just makes sense that your longest friend keeps the #1 spot, right?
}

function UserAvatar({
    src,
    className,
    placeholderClassName,
    alt
}: Readonly<{ src: string; className: string; placeholderClassName: string; alt: string; }>) {
    const [broken, setBroken] = React.useState(false);

    if (!src || broken) {
        return <div className={placeholderClassName} aria-hidden="true" />;
    }

    return (
        <img
            className={className}
            src={src}
            alt={alt}
            onError={() => setBroken(true)}
        />
    );
}

function PodiumCard({ entry, place, rank, onClick }: PodiumCardWithActionProps) {
    if (!entry) {
        return (
            <div className={cl("podium-card", `podium-${place}`)}>
                {place === 1 && <div className={cl("podium-crown")} aria-hidden="true">👑</div>}
                <div className={cl("avatar-placeholder")} />
                <div className={cl("podium-name")}>Empty</div>
                <div className={cl("podium-value")}>-</div>
            </div>
        );
    }

    return (
        <button
            type="button"
            className={cl("podium-card", `podium-${place}`, "podium-clickable")}
            onClick={onClick}
            aria-label={`Open profile of ${entry.name}. Rank ${rank}. Friendship ${formatYears(entry.friendshipYears)}.`}
        >
            {place === 1 && <div className={cl("podium-crown")} aria-hidden="true">👑</div>}
            <UserAvatar
                className={cl("podium-avatar")}
                placeholderClassName={cl("avatar-placeholder")}
                src={entry.avatarUrl}
                alt=""
            />
            <div className={cl("podium-name")}>{entry.name}</div>
            <Tooltip text={formatFriendshipTooltip(entry.friendshipDays, entry.friendshipSince)}>
                {tooltipProps => (
                    <div className={cl("podium-value")} {...tooltipProps}>
                        {formatYears(entry.friendshipYears)}
                    </div>
                )}
            </Tooltip>
        </button>
    );
}

function PodiumStand({ place, rank }: PodiumStandProps) {
    return (
        <div className={cl("podium-stand", `podium-stand-${place}`)} aria-hidden="true">
            <span className={cl("podium-stand-rank")}>#{rank}</span>
        </div>
    );
}

function openFriendProfile(userId: string, onDone?: () => void) {
    openUserProfile(userId);
    onDone?.();
}

function OpenLeaderboardButton() {
    return (
        <HeaderBarButton
            className={cl("topbar-btn")}
            onClick={handleOpenLeaderboard}
            tooltip="Open Friendship Leaderboard"
            icon={UserIcon}
        />
    );
}

function LeaderboardModal({ modalProps }: Readonly<{ modalProps: RenderModalProps; }>) {
    const [sortDescending, setSortDescending] = React.useState(Boolean(settings.store.sortDescending));
    const closeModal = React.useCallback(() => modalProps.onClose(), [modalProps]);

    const leaderboard = React.useMemo(() => {
        const rows = getFriendEntries()
            .sort((a, b) => sortDescending ? b.friendshipYears - a.friendshipYears : a.friendshipYears - b.friendshipYears);

        return rows;
    }, [sortDescending]);
    const totalEntries = leaderboard.length;

    const setSortDescendingBoth = (value: boolean) => {
        setSortDescending(value);
        settings.store.sortDescending = value;
    };

    return (
        <Modal
            {...modalProps}
            size="lg"
            title="Friendship Leaderboard"
        >
            <div className={cl("container")}>
                <div className={cl("filters")}>
                    <div className={cl("field")}>
                        <div className={cl("sort-toggle")} aria-label="Sort order">
                            <button
                                type="button"
                                className={cl("sort-toggle-btn", { "sort-toggle-btn-active": sortDescending })}
                                aria-pressed={sortDescending}
                                onClick={() => setSortDescendingBoth(true)}
                            >
                                <span className={cl("sort-toggle-icon")} aria-hidden="true">↑</span>
                                <span>Most to least</span>
                            </button>
                            <button
                                type="button"
                                className={cl("sort-toggle-btn", { "sort-toggle-btn-active": !sortDescending })}
                                aria-pressed={!sortDescending}
                                onClick={() => setSortDescendingBoth(false)}
                            >
                                <span className={cl("sort-toggle-icon")} aria-hidden="true">↓</span>
                                <span>Least to most</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className={cl("podium")}>
                    {/* Podium slots follow the active sort order */}
                    <div className={cl("podium-slot", "podium-slot-2")}>
                        <PodiumCard
                            place={2}
                            rank={getLeaderboardRank(1, totalEntries, sortDescending)}
                            entry={leaderboard[1]}
                            onClick={() => leaderboard[1] && openFriendProfile(leaderboard[1].id, closeModal)}
                        />
                        <PodiumStand place={2} rank={getLeaderboardRank(1, totalEntries, sortDescending)} />
                    </div>
                    <div className={cl("podium-slot", "podium-slot-1")}>
                        <PodiumCard
                            place={1}
                            rank={getLeaderboardRank(0, totalEntries, sortDescending)}
                            entry={leaderboard[0]}
                            onClick={() => leaderboard[0] && openFriendProfile(leaderboard[0].id, closeModal)}
                        />
                        <PodiumStand place={1} rank={getLeaderboardRank(0, totalEntries, sortDescending)} />
                    </div>
                    <div className={cl("podium-slot", "podium-slot-3")}>
                        <PodiumCard
                            place={3}
                            rank={getLeaderboardRank(2, totalEntries, sortDescending)}
                            entry={leaderboard[2]}
                            onClick={() => leaderboard[2] && openFriendProfile(leaderboard[2].id, closeModal)}
                        />
                        <PodiumStand place={3} rank={getLeaderboardRank(2, totalEntries, sortDescending)} />
                    </div>
                </div>

                <div className={cl("summary")}>
                    <span className={cl("summary-place")}>Place</span>
                    <span className={cl("summary-name")}>Name</span>
                    <span className={cl("summary-side")}>Friends Since</span>
                </div>

                <div className={cl("list")}>
                    {leaderboard.slice(3).map((entry, index) => (
                        <button
                            type="button"
                            key={entry.id}
                            className={cl("row")}
                            onClick={() => openFriendProfile(entry.id, closeModal)}
                            aria-label={`Open profile of ${entry.name}. Rank ${getLeaderboardRank(index + 3, totalEntries, sortDescending)}. Friendship ${formatYears(entry.friendshipYears)}.`}
                        >
                            <span className={cl("rank")}>#{getLeaderboardRank(index + 3, totalEntries, sortDescending)}</span>
                            <UserAvatar
                                className={cl("avatar")}
                                placeholderClassName={cl("avatar-fallback")}
                                src={entry.avatarUrl}
                                alt=""
                            />
                            <div className={cl("info")}>
                                <div className={cl("name")}>{entry.name}</div>
                            </div>
                            <Tooltip text={formatFriendshipTooltip(entry.friendshipDays, entry.friendshipSince)}>
                                {tooltipProps => (
                                    <span className={cl("score")} {...tooltipProps}>
                                        {formatYears(entry.friendshipYears)}
                                    </span>
                                )}
                            </Tooltip>
                        </button>
                    ))}

                    {!leaderboard.length && (
                        <div className={cl("empty")}>No friends match your filter.</div>
                    )}
                </div>
            </div>
        </Modal>
    );
}

function handleOpenLeaderboard() {
    openModal(modalProps => (
        <LeaderboardModal modalProps={modalProps} />
    ));
}

export default definePlugin({
    name: "FriendshipLeaderboard",
    description: "Shows a leaderboard of your friends based on how long you've been friends with them.",
    tags: ["Friends", "Organisation"],
    authors: [EquicordDevs.Paid],
    settings,

    toolboxActions: {
        "Friendship Leaderboard"() {
            handleOpenLeaderboard();
        }
    },

    dependencies: ["HeaderBarAPI"],

    headerBarButton: {
        icon: UserIcon,
        render: OpenLeaderboardButton
    },

    settingsAboutComponent: () => (
        <div className={cl("about")}>
            <div className={cl("about-title")}>Friendship Leaderboard</div>
            <div className={cl("about-text")}>
                Opens a custom leaderboard modal with a podium for your longest friends.
            </div>
            <button className={cl("open-button")} onClick={handleOpenLeaderboard}>
                Open Leaderboard
            </button>
        </div>
    )
});
