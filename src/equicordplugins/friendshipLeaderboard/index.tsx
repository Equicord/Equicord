/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { UserIcon } from "@components/Icons";
import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";

import { OpenLeaderboardButton, openLeaderboardModal, SettingsAboutComponent } from "./components";
import { settings } from "./settings";

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

    settingsAboutComponent: SettingsAboutComponent
});
