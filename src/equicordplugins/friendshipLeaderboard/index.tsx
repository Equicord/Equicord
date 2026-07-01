/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { UserIcon } from "@components/Icons";
import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { Message } from "@vencord/discord-types";
import { ChannelStore, UserStore } from "@webpack/common";

import { OpenLeaderboardButton, openLeaderboardModal, SettingsAboutComponent } from "./components";
import { getCacheKey, useMessageCountStore } from "./data";
import { settings } from "./settings";
import { MessageCountModes } from "./types";

export default definePlugin({
    name: "FriendshipLeaderboard",
    description: "Shows a leaderboard of your friends based on how long you've been friends with them.",
    tags: ["Friends", "Organisation"],
    authors: [EquicordDevs.Paid],
    settings,

    toolboxActions: {
        "Friendship Leaderboard"() {
            openLeaderboardModal();
        }
    },

    dependencies: ["HeaderBarAPI"],

    headerBarButton: {
        icon: UserIcon,
        render: OpenLeaderboardButton
    },

    settingsAboutComponent: SettingsAboutComponent,

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
