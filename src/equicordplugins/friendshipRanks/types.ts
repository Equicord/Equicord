/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface LeaderboardEntry {
    id: string;
    name: string;
    avatarUrl: string;
    friendshipDays: number;
    friendshipSince: string | null;
    friendshipYears: number;
    messageCount?: number;
}

export interface FriendshipRankBadge {
    title: string;
    description: string;
    requirement: number;
    iconSrc: string;
}

export type SortMode = typeof SortModes[keyof typeof SortModes];

export const SortModes = {
    FRIENDSHIP: "friendship",
    MESSAGES: "messages"
} as const;

export const MessageCountModes = {
    SENT: "sent",
    RECEIVED: "received",
    ALL: "all"
} as const;

export type MessageCountMode = typeof MessageCountModes[keyof typeof MessageCountModes];

export const SORT_MODE_LABELS = {
    [SortModes.FRIENDSHIP]: "Friendship Duration",
    [SortModes.MESSAGES]: "Messages"
} as const;

export const LEADERBOARD_SETTINGS_KEYS: ("sortDescending" | "sortMode" | "messageCountMode" | "trackedFriendIds")[] = ["sortDescending", "sortMode", "messageCountMode", "trackedFriendIds"];

export const FRIENDSHIP_RANK_BADGES: FriendshipRankBadge[] = [
    {
        title: "Sprout",
        description: "Your friendship is just starting",
        requirement: 0,
        iconSrc: "https://equicord.org/assets/plugins/friendshipRanks/sprout.png"
    },
    {
        title: "Blooming",
        description: "Your friendship is getting there! (1 Month)",
        requirement: 30,
        iconSrc: "https://equicord.org/assets/plugins/friendshipRanks/blooming.png"
    },
    {
        title: "Burning",
        description: "Your friendship has reached terminal velocity (3 Months)",
        requirement: 90,
        iconSrc: "https://equicord.org/assets/plugins/friendshipRanks/burning.png"
    },
    {
        title: "Fighter",
        description: "Your friendship is strong (6 Months)",
        requirement: 182.5,
        iconSrc: "https://equicord.org/assets/plugins/friendshipRanks/fighter.png"
    },
    {
        title: "Star",
        description: "Your friendship has been going on for a WHILE (1 Year)",
        requirement: 365,
        iconSrc: "https://equicord.org/assets/plugins/friendshipRanks/star.png"
    },
    {
        title: "Royal",
        description: "Your friendship has gone through thick and thin- a whole 2 years!",
        requirement: 730,
        iconSrc: "https://equicord.org/assets/plugins/friendshipRanks/royal.png"
    },
    {
        title: "Besties",
        description: "How do you even manage this??? (5 Years)",
        requirement: 1826.25,
        iconSrc: "https://equicord.org/assets/plugins/friendshipRanks/besties.png"
    }
];
