/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export interface FavouriteCategory {
    id: string;
    name: string;
    collapsed: boolean;
}

export interface FavouriteChannel {
    id: string;
    categoryId: string | null;
    nickname: string | null;
}

export interface UserFavourites {
    categories: FavouriteCategory[];
    channels: FavouriteChannel[];
}

export const settings = definePluginSettings({
    showButton: {
        type: OptionType.BOOLEAN,
        description: "Show the Favourites button in the server list.",
        default: true
    },
    showServerName: {
        type: OptionType.BOOLEAN,
        description: "Show the server name under each favourite channel.",
        default: false
    },
    showThreadParent: {
        type: OptionType.BOOLEAN,
        description: "Show the parent channel under each favourite thread.",
        default: true
    },
    muted: {
        type: OptionType.BOOLEAN,
        description: "Hide the unread indicator on the Favourites button. Mentions still show.",
        default: false
    },
    autoAddThreads: {
        type: OptionType.BOOLEAN,
        description: "Add threads you join to an Auto-Added Threads category.",
        default: false
    },
    suggestionsDismissed: {
        type: OptionType.BOOLEAN,
        description: "Hide the Suggested Channels section.",
        default: false,
        hidden: true
    },
    favourites: {
        type: OptionType.CUSTOM,
        description: "",
        default: {} as Record<string, UserFavourites>
    }
});
