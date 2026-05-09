/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { get, set } from "@api/DataStore";
import { DecoratorProps } from "@api/MemberListDecorators";
import { iconsModule } from "@equicordplugins/_core/concatenatedModules";
import { EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import definePlugin from "@utils/types";
import { ChannelStore, Tooltip, UserStore } from "@webpack/common";

const cl = classNameFactory("vc-streaks-");

const dataKey = "vc-streaks-data";
const minStreak = 1;

const sent = 1;
const received = 2;
const both = 3;

interface UserStreak {
    count: number;
    lastDay: string;
    todayFlags: number;
    todayDate: string;
}

let cache: Record<string, UserStreak> = {};

function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function yesterdayKey() {
    const d = new Date(Date.now() - 86400000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function updateok(userId: string, outgoing: boolean) {
    const today = todayKey();
    const entry = cache[userId] ??= { count: 0, lastDay: "", todayFlags: 0, todayDate: "" };

    if (entry.todayDate !== today) {
        entry.todayDate = today;
        entry.todayFlags = 0;
    }

    const next = entry.todayFlags | (outgoing ? sent : received);
    if (next === entry.todayFlags) return;
    entry.todayFlags = next;

    if (next === both && entry.lastDay !== today) {
        entry.count = entry.lastDay === yesterdayKey() ? entry.count + 1 : 1;
        entry.lastDay = today;
    }

    set(dataKey, cache);
}

function streakOf(userId: string) {
    const entry = cache[userId];
    if (!entry) return 0;
    if (entry.lastDay === todayKey() || entry.lastDay === yesterdayKey()) return entry.count;
    return 0;
}

function activeToday(userId: string) {
    return cache[userId]?.lastDay === todayKey();
}

function colorFor(streak: number) {
    if (streak >= 100) return "#9b39fe";
    if (streak >= 60) return "#f7409c";
    if (streak >= 30) return "#f75340";
    if (streak >= 14) return "#f57b0b";
    return "#f59e0b";
}

function StreakBadge({ userId }: { userId: string; }) {
    const streak = streakOf(userId);
    if (streak < minStreak) return null;

    const FireIcon = iconsModule?.FireIcon;
    const color = activeToday(userId) ? colorFor(streak) : "#9ca3af";

    return (
        <Tooltip text={`${streak} day streak`}>
            {tooltipProps => (
                <span {...tooltipProps} className={cl("badge")} style={{ color }}>
                    {FireIcon && <FireIcon size="xs" color={color} />}
                    <span className={cl("count")}>{streak}</span>
                </span>
            )}
        </Tooltip>
    );
}

export default definePlugin({
    name: "Streaks",
    description: "Shows a streak next to a user when you exchange DMs with them on consecutive days.",
    authors: [EquicordDevs.Moowi],
    tags: ["Friends", "Fun"],
    dependencies: ["MessageDecorationsAPI", "MemberListDecoratorsAPI", "ConcatenatedModules"],

    async start() {
        cache = (await get(dataKey)) ?? {};
    },

    stop() {
        cache = {};
    },

    flux: {
        MESSAGE_CREATE({ message }) {
            const me = UserStore.getCurrentUser();
            if (!me || !message?.author) return;

            const channel = ChannelStore.getChannel(message.channel_id);
            if (channel?.type !== 1) return;

            const recipientId = channel.recipients?.[0];
            if (!recipientId) return;

            if (message.author.id === me.id) updateok(recipientId, true);
            else if (message.author.id === recipientId) updateok(recipientId, false);
        },
    },

    renderMessageDecoration(props) {
        const userId = props.message?.author?.id;
        if (!userId || userId === UserStore.getCurrentUser()?.id) return null;
        return <StreakBadge userId={userId} />;
    },

    renderMemberListDecorator({ user }: DecoratorProps) {
        if (!user || user.id === UserStore.getCurrentUser()?.id) return null;
        return <StreakBadge userId={user.id} />;
    },
});
