/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export const settings = definePluginSettings({
    showAllTab: {
        type: OptionType.BOOLEAN,
        description: "Show the 'All' tab.",
        default: false
    },
    showMentionsTab: {
        type: OptionType.BOOLEAN,
        description: "Show the 'Mentions' tab (replies, blocked mentions, edits to messages mentioning you, native @-mentions).",
        default: true
    },
    showReactionsTab: {
        type: OptionType.BOOLEAN,
        description: "Show the 'Reactions' tab.",
        default: true
    },
    showActivityTab: {
        type: OptionType.BOOLEAN,
        description: "Show the 'Activity' tab (threads, pins, group invites, friend requests, scheduled events).",
        default: false
    },
    hideNativeTabs: {
        type: OptionType.BOOLEAN,
        description: "Hide Discord's native inbox tabs. Discord's @-mentions are merged into our tabs so you don't lose them.",
        default: true
    },
    includeDiscordMentions: {
        type: OptionType.BOOLEAN,
        description: "Merge Discord's native @-mentions into our tabs.",
        default: true
    },
    includeReplies: {
        type: OptionType.BOOLEAN,
        description: "Capture silent replies to your messages.",
        default: true
    },
    includeForumReplies: {
        type: OptionType.BOOLEAN,
        description: "Capture new messages in threads or forum posts you started or joined.",
        default: true
    },
    includeReactions: {
        type: OptionType.BOOLEAN,
        description: "Capture reactions on your messages.",
        default: true
    },
    includeThreadCreations: {
        type: OptionType.BOOLEAN,
        description: "Capture threads created from your messages.",
        default: true
    },
    includePins: {
        type: OptionType.BOOLEAN,
        description: "Capture pins on your messages.",
        default: true
    },
    includeMentionEdits: {
        type: OptionType.BOOLEAN,
        description: "Capture edits to messages mentioning you.",
        default: true
    },
    includeBlockedMentions: {
        type: OptionType.BOOLEAN,
        description: "Capture mentions from blocked users.",
        default: false
    },
    includeGroupDmAdds: {
        type: OptionType.BOOLEAN,
        description: "Capture being added to group DMs.",
        default: true
    },
    includeFriendRequests: {
        type: OptionType.BOOLEAN,
        description: "Capture incoming friend requests.",
        default: true
    },
    includeFriendAdded: {
        type: OptionType.BOOLEAN,
        description: "Capture new friendships.",
        default: true
    },
    includeScheduledEvents: {
        type: OptionType.BOOLEAN,
        description: "Capture new server scheduled events.",
        default: false
    },
    ignoreBots: {
        type: OptionType.BOOLEAN,
        description: "Ignore replies, reactions, and edits from bots.",
        default: true
    },
    ignoreSelf: {
        type: OptionType.BOOLEAN,
        description: "Ignore your own actions on your own messages.",
        default: true
    },
    ignoreEveryoneAndRoleMentions: {
        type: OptionType.BOOLEAN,
        description: "Hide @everyone, @here, and role mentions unless you are also directly @-mentioned.",
        default: false
    },
    ignoreMutedServers: {
        type: OptionType.BOOLEAN,
        description: "Hide notifications from servers you have muted.",
        default: false
    },
    amountToKeep: {
        type: OptionType.NUMBER,
        description: "Max entries to keep. 0 means unlimited.",
        default: 0
    }
});
