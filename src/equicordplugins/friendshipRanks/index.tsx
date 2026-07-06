/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { BadgePosition, BadgeUserArgs } from "@api/Badges";
import { Badges } from "@api/index";
import { UserIcon } from "@components/Icons";
import { Devs, EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { Message } from "@vencord/discord-types";
import { ChannelStore, UserStore } from "@webpack/common";

import { OpenLeaderboardButton, openLeaderboardModal, openRankModal, SettingsAboutComponent } from "./components";
import { getCacheKey, shouldShowProfileBadge, useMessageCountStore } from "./data";
import { settings } from "./settings";
import { FRIENDSHIP_RANK_BADGES, MessageCountModes } from "./types";
import { activeMessageCountBatch } from "./data";

function getProfileBadges() {
    return FRIENDSHIP_RANK_BADGES.map((rank, index) => ({
        id: `friendship_ranks_badge_${index}`,
        description: rank.title,
        iconSrc: rank.iconSrc,
        position: BadgePosition.END,
        onClick: () => openRankModal(rank),
        shouldShow: (info: BadgeUserArgs) => shouldShowProfileBadge(info.userId, rank.requirement, index),
        props: {
            style: {
                borderRadius: "50%",
                transform: "scale(0.9)"
            }
        },
    }));
}

export default definePlugin({
    name: "FriendshipRanks",
    description: "Adds badges showcasing how long you have been friends with a user for, and a leaderboard of your friends based on how long you've been friends with them.",
    tags: ["Friends", "Organisation"],
    authors: [Devs.Samwich, EquicordDevs.Paid],
    settings,

    toolboxActions: {
        "Friendship Leaderboard"() {
            openLeaderboardModal();
        }
    },

    dependencies: ["HeaderBarAPI", "BadgeAPI"],

    headerBarButton: {
        icon: UserIcon,
        render: OpenLeaderboardButton
    },

    settingsAboutComponent: SettingsAboutComponent,

    start() {
        getProfileBadges().forEach(b => Badges.addProfileBadge(b));
    },

    stop() {
        getProfileBadges().forEach(b => Badges.removeProfileBadge(b));
        activeMessageCountBatch = null;
    },

    flux: {
        MESSAGE_CREATE({ optimistic, type, message }: { optimistic: boolean; type: string; message: Message; channelId: string; }) {
            if (optimistic || type !== "MESSAGE_CREATE" || message.state === "SENDING") return;

            const channel = ChannelStore.getChannel(message.channel_id);
            if (!channel?.isDM?.() || channel.isMultiUserDM?.()) return;

            const currentUserId = UserStore.getCurrentUser()?.id;
            if (!currentUserId || !message.author?.id) return;

            const friendId = message.author.id === currentUserId
                ? channel.recipients?.[0]
                : message.author.id;

            if (!friendId) return;

            const mode = message.author.id === currentUserId
                ? MessageCountModes.SENT
                : MessageCountModes.RECEIVED;

            const specificCacheKey = getCacheKey(friendId, mode);
            const allCacheKey = getCacheKey(friendId, MessageCountModes.ALL);
            useMessageCountStore.getState().increment(specificCacheKey);
            useMessageCountStore.getState().increment(allCacheKey);
        }
    }
});
