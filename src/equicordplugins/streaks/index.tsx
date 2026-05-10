/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { DataStore } from "@api/index";
import { DecoratorProps } from "@api/MemberListDecorators";
import { iconsModule } from "@equicordplugins/_core/concatenatedModules";
import { EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import definePlugin from "@utils/types";
import { Message } from "@vencord/discord-types";
import { ChannelStore, moment, SelectedChannelStore, Tooltip, UserStore } from "@webpack/common";

const cl = classNameFactory("vc-streaks-");
const dataKey = "vc-streaks-data";

const Flags = {
    SENT: 1,
    RECEIVED: 2,
    BOTH: 3
};

const STREAK_THRESHOLDS = {
    ELITE: 100,
    DIAMOND: 60,
    GOLD: 30,
    SILVER: 14
};

interface UserStreak {
    count: number;
    lastDay: string;
    todayFlags: number;
    todayDate: string;
}

let streaks: Record<string, UserStreak> = {};

const todayKey = () => moment().format("YYYY-MM-DD");
const yesterdayKey = () => moment().subtract(1, "day").format("YYYY-MM-DD");

const updateStreak = (userId: string, outgoing: boolean) => {
    const today = todayKey();
    const entry = streaks[userId] ??= { count: 0, lastDay: "", todayFlags: 0, todayDate: "" };

    if (entry.todayDate !== today) {
        entry.todayDate = today;
        entry.todayFlags = 0;
    }

    const next = entry.todayFlags | (outgoing ? Flags.SENT : Flags.RECEIVED);
    if (next === entry.todayFlags) return;
    entry.todayFlags = next;

    if (next === Flags.BOTH && entry.lastDay !== today) {
        entry.count = entry.lastDay === yesterdayKey() ? entry.count + 1 : 1;
        entry.lastDay = today;
    }

    DataStore.set(dataKey, streaks);
};

const getStreakInfo = (userId: string) => {
    const entry = streaks[userId];
    if (!entry) return null;
    const today = todayKey();
    if (entry.lastDay !== today && entry.lastDay !== yesterdayKey()) return null;
    return { count: entry.count, active: entry.lastDay === today };
};

const colorFor = (streak: number) => {
    if (streak >= STREAK_THRESHOLDS.ELITE) return "#9b39fe";
    if (streak >= STREAK_THRESHOLDS.DIAMOND) return "#f7409c";
    if (streak >= STREAK_THRESHOLDS.GOLD) return "#f75340";
    if (streak >= STREAK_THRESHOLDS.SILVER) return "#f57b0b";
    return "#f59e0b";
};

const StreakBadge = ({ userId }: { userId: string; }) => {
    const info = getStreakInfo(userId);
    if (!info || info.count < 1) return null;

    const FireIcon = iconsModule?.FireIcon;
    const color = info.active ? colorFor(info.count) : "#9ca3af";

    return (
        <Tooltip text={`${info.count} day streak`}>
            {tooltipProps => (
                <span {...tooltipProps} className={cl("badge")} style={{ color }}>
                    {FireIcon && <FireIcon size="xs" color={color} />}
                    <span className={cl("count")}>{info.count}</span>
                </span>
            )}
        </Tooltip>
    );
};

export default definePlugin({
    name: "Streaks",
    description: "Shows a streak next to a user when you exchange DMs with them on consecutive days.",
    authors: [EquicordDevs.Moowi],
    tags: ["Friends", "Fun"],
    dependencies: ["MessageDecorationsAPI", "MemberListDecoratorsAPI", "ConcatenatedModules"],

    async start() {
        streaks = await DataStore.get(dataKey) ?? {};
    },

    stop() {
        streaks = {};
    },

    flux: {
        async MESSAGE_CREATE({ optimistic, type, message, channelId }: { optimistic: boolean; type: string; message: Message; channelId: string; }) {
            if (optimistic || type !== "MESSAGE_CREATE" || message.state === "SENDING") return;
            if (message.author?.bot) return;

            const channel = ChannelStore.getChannel(channelId);
            if (!channel.isDM()) return;

            const recipientId = channel.recipients[0];
            if (!recipientId) return;

            const me = UserStore.getCurrentUser()?.id;
            if (message.author.id === me) updateStreak(recipientId, true);
            else if (message.author.id === recipientId) updateStreak(recipientId, false);
        },
    },

    renderMessageDecoration({ message }) {
        const userId = message?.author?.id;
        if (!userId || userId === UserStore.getCurrentUser()?.id) return null;
        return <StreakBadge userId={userId} />;
    },

    renderMemberListDecorator({ user }: DecoratorProps) {
        if (!user || user.id === UserStore.getCurrentUser()?.id) return null;
        return <StreakBadge userId={user.id} />;
    },
});
