/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { t } from "@utils/translation";
import { OptionType } from "@utils/types";

export const settings = definePluginSettings({
    oneBadgePerChannel: {
        type: OptionType.BOOLEAN,
        default: false,
        description: t("channelBadges.settings.oneBadgePerChannel"),
        restartNeeded: true,
    },
    showTextBadge: {
        type: OptionType.BOOLEAN,
        default: true,
        description: t("channelBadges.settings.showTextBadge"),
        restartNeeded: true,
    },
    showVoiceBadge: {
        type: OptionType.BOOLEAN,
        default: true,
        description: t("channelBadges.settings.showVoiceBadge"),
        restartNeeded: true,
    },
    showCategoryBadge: {
        type: OptionType.BOOLEAN,
        default: true,
        description: t("channelBadges.settings.showCategoryBadge"),
        restartNeeded: true,
    },
    showDirectoryBadge: {
        type: OptionType.BOOLEAN,
        default: true,
        description: t("channelBadges.settings.showDirectoryBadge"),
        restartNeeded: true,
    },
    showAnnouncementThreadBadge: {
        type: OptionType.BOOLEAN,
        default: true,
        description: t("channelBadges.settings.showAnnouncementThreadBadge"),
        restartNeeded: true,
    },
    showPublicThreadBadge: {
        type: OptionType.BOOLEAN,
        default: true,
        description: t("channelBadges.settings.showPublicThreadBadge"),
        restartNeeded: true,
    },
    showPrivateThreadBadge: {
        type: OptionType.BOOLEAN,
        default: true,
        description: t("channelBadges.settings.showPrivateThreadBadge"),
        restartNeeded: true,
    },
    showStageBadge: {
        type: OptionType.BOOLEAN,
        default: true,
        description: t("channelBadges.settings.showStageBadge"),
        restartNeeded: true,
    },
    showAnnouncementBadge: {
        type: OptionType.BOOLEAN,
        default: true,
        description: t("channelBadges.settings.showAnnouncementBadge"),
        restartNeeded: true,
    },
    showForumBadge: {
        type: OptionType.BOOLEAN,
        default: true,
        description: t("channelBadges.settings.showForumBadge"),
        restartNeeded: true,
    },
    showMediaBadge: {
        type: OptionType.BOOLEAN,
        default: true,
        description: t("channelBadges.settings.showMediaBadge"),
        restartNeeded: true,
    },
    showNSFWBadge: {
        type: OptionType.BOOLEAN,
        default: true,
        description: t("channelBadges.settings.showNSFWBadge"),
        restartNeeded: true,
    },
    showLockedBadge: {
        type: OptionType.BOOLEAN,
        default: true,
        description: t("channelBadges.settings.showLockedBadge"),
        restartNeeded: true,
    },
    showRulesBadge: {
        type: OptionType.BOOLEAN,
        default: true,
        description: t("channelBadges.settings.showRulesBadge"),
        restartNeeded: true,
    },
    showUnknownBadge: {
        type: OptionType.BOOLEAN,
        default: true,
        description: t("channelBadges.settings.showUnknownBadge"),
        restartNeeded: true,
    },

    textBadgeLabel: {
        type: OptionType.STRING,
        default: "Text",
        description: t("channelBadges.settings.textBadgeLabel"),
        restartNeeded: true,
    },
    voiceBadgeLabel: {
        type: OptionType.STRING,
        default: "Voice",
        description: t("channelBadges.settings.voiceBadgeLabel"),
        restartNeeded: true,
    },
    categoryBadgeLabel: {
        type: OptionType.STRING,
        default: "Category",
        description: t("channelBadges.settings.categoryBadgeLabel"),
        restartNeeded: true,
    },
    announcementBadgeLabel: {
        type: OptionType.STRING,
        default: "News",
        description: t("channelBadges.settings.announcementBadgeLabel"),
        restartNeeded: true,
    },
    announcementThreadBadgeLabel: {
        type: OptionType.STRING,
        default: "News Thread",
        description: t("channelBadges.settings.announcementThreadBadgeLabel"),
        restartNeeded: true,
    },
    publicThreadBadgeLabel: {
        type: OptionType.STRING,
        default: "Thread",
        description: t("channelBadges.settings.publicThreadBadgeLabel"),
        restartNeeded: true,
    },
    privateThreadBadgeLabel: {
        type: OptionType.STRING,
        default: "Private Thread",
        description: t("channelBadges.settings.privateThreadBadgeLabel"),
        restartNeeded: true,
    },
    stageBadgeLabel: {
        type: OptionType.STRING,
        default: "Stage",
        description: t("channelBadges.settings.stageBadgeLabel"),
        restartNeeded: true,
    },
    directoryBadgeLabel: {
        type: OptionType.STRING,
        default: "Directory",
        description: t("channelBadges.settings.directoryBadgeLabel"),
        restartNeeded: true,
    },
    forumBadgeLabel: {
        type: OptionType.STRING,
        default: "Forum",
        description: t("channelBadges.settings.forumBadgeLabel"),
        restartNeeded: true,
    },
    mediaBadgeLabel: {
        type: OptionType.STRING,
        default: "Media",
        description: t("channelBadges.settings.mediaBadgeLabel"),
        restartNeeded: true,
    },
    nsfwBadgeLabel: {
        type: OptionType.STRING,
        default: "NSFW",
        description: t("channelBadges.settings.nsfwBadgeLabel"),
        restartNeeded: true,
    },
    lockedBadgeLabel: {
        type: OptionType.STRING,
        default: "Locked",
        description: t("channelBadges.settings.lockedBadgeLabel"),
        restartNeeded: true,
    },
    rulesBadgeLabel: {
        type: OptionType.STRING,
        default: "Rules",
        description: t("channelBadges.settings.rulesBadgeLabel"),
        restartNeeded: true,
    },
    unknownBadgeLabel: {
        type: OptionType.STRING,
        default: "Unknown",
        description: t("channelBadges.settings.unknownBadgeLabel"),
        restartNeeded: true,
    },

    textBadgeColor: {
        type: OptionType.STRING,
        description: t("channelBadges.settings.textBadgeColor"),
        restartNeeded: true,
    },
    voiceBadgeColor: {
        type: OptionType.STRING,
        description: t("channelBadges.settings.voiceBadgeColor"),
        restartNeeded: true,
    },
    categoryBadgeColor: {
        type: OptionType.STRING,
        description: t("channelBadges.settings.categoryBadgeColor"),
        restartNeeded: true,
    },
    announcementBadgeColor: {
        type: OptionType.STRING,
        description: t("channelBadges.settings.announcementBadgeColor"),
        restartNeeded: true,
    },
    announcementThreadBadgeColor: {
        type: OptionType.STRING,
        description: t("channelBadges.settings.announcementThreadBadgeColor"),
        restartNeeded: true,
    },
    publicThreadBadgeColor: {
        type: OptionType.STRING,
        description: t("channelBadges.settings.publicThreadBadgeColor"),
        restartNeeded: true,
    },
    privateThreadBadgeColor: {
        type: OptionType.STRING,
        description: t("channelBadges.settings.privateThreadBadgeColor"),
        restartNeeded: true,
    },
    stageBadgeColor: {
        type: OptionType.STRING,
        description: t("channelBadges.settings.stageBadgeColor"),
        restartNeeded: true,
    },
    directoryBadgeColor: {
        type: OptionType.STRING,
        description: t("channelBadges.settings.directoryBadgeColor"),
        restartNeeded: true,
    },
    forumBadgeColor: {
        type: OptionType.STRING,
        description: t("channelBadges.settings.forumBadgeColor"),
        restartNeeded: true,
    },
    mediaBadgeColor: {
        type: OptionType.STRING,
        description: t("channelBadges.settings.mediaBadgeColor"),
        restartNeeded: true,
    },
    nsfwBadgeColor: {
        type: OptionType.STRING,
        description: t("channelBadges.settings.nsfwBadgeColor"),
        restartNeeded: true,
    },
    lockedBadgeColor: {
        type: OptionType.STRING,
        description: t("channelBadges.settings.lockedBadgeColor"),
        restartNeeded: true,
    },
    rulesBadgeColor: {
        type: OptionType.STRING,
        description: t("channelBadges.settings.rulesBadgeColor"),
        restartNeeded: true,
    },
    unknownBadgeColor: {
        type: OptionType.STRING,
        description: t("channelBadges.settings.unknownBadgeColor"),
        restartNeeded: true,
    },
});

export const defaultValues = {
    showTextBadge: true,
    showVoiceBadge: true,
    showCategoryBadge: true,
    showAnnouncementBadge: true,
    showAnnouncementThreadBadge: true,
    showPublicThreadBadge: true,
    showPrivateThreadBadge: true,
    showStageBadge: true,
    showDirectoryBadge: true,
    showForumBadge: true,
    showMediaBadge: true,
    showNSFWBadge: true,
    showLockedBadge: true,
    showRulesBadge: true,
    showUnknownBadge: true,

    channelBadges: {
        text: "Text",
        voice: "Voice",
        category: "Category",
        announcement: "News",
        announcement_thread: "News Thread",
        public_thread: "Thread",
        private_thread: "Private Thread",
        stage: "Stage",
        directory: "Directory",
        forum: "Forum",
        media: "Media",
        nsfw: "NSFW",
        locked: "Locked",
        rules: "Rules",
        unknown: "Unknown"
    },
    lockedBadgeTooltip: "This channel is locked.",
    nsfwBadgeTooltip: "This channel is marked as NSFW.",
};

export function isEnabled(type: number) {
    const fromValues = settings.store;

    switch (type) {
        case 0:
            return fromValues.showTextBadge;
        case 2:
            return fromValues.showVoiceBadge;
        case 4:
            return fromValues.showCategoryBadge;
        case 5:
            return fromValues.showAnnouncementBadge;
        case 10:
            return fromValues.showAnnouncementThreadBadge;
        case 11:
            return fromValues.showPublicThreadBadge;
        case 12:
            return fromValues.showPrivateThreadBadge;
        case 13:
            return fromValues.showStageBadge;
        case 14:
            return fromValues.showDirectoryBadge;
        case 15:
            return fromValues.showForumBadge;
        case 16:
            return fromValues.showMediaBadge;
        case 6100:
            return fromValues.showNSFWBadge;
        case 6101:
            return fromValues.showLockedBadge;
        case 6102:
            return fromValues.showRulesBadge;
        default:
            return fromValues.showUnknownBadge;
    }
}

export function returnChannelBadge(type: number) {
    switch (type) {
        case 0:
            return { css: "text", label: settings.store.textBadgeLabel, color: settings.store.textBadgeColor };
        case 2:
            return { css: "voice", label: settings.store.voiceBadgeLabel, color: settings.store.voiceBadgeColor };
        case 4:
            return { css: "category", label: settings.store.categoryBadgeLabel, color: settings.store.categoryBadgeColor };
        case 5:
            return { css: "announcement", label: settings.store.announcementBadgeLabel, color: settings.store.announcementBadgeColor };
        case 10:
            return { css: "announcement-thread", label: settings.store.announcementThreadBadgeLabel, color: settings.store.announcementThreadBadgeColor };
        case 11:
            return { css: "thread", label: settings.store.publicThreadBadgeLabel, color: settings.store.publicThreadBadgeColor };
        case 12:
            return { css: "private-thread", label: settings.store.privateThreadBadgeLabel, color: settings.store.privateThreadBadgeColor };
        case 13:
            return { css: "stage", label: settings.store.stageBadgeLabel, color: settings.store.stageBadgeColor };
        case 14:
            return { css: "directory", label: settings.store.directoryBadgeLabel, color: settings.store.directoryBadgeColor };
        case 15:
            return { css: "forum", label: settings.store.forumBadgeLabel, color: settings.store.forumBadgeColor };
        case 16:
            return { css: "media", label: settings.store.mediaBadgeLabel, color: settings.store.mediaBadgeColor };
        case 6100:
            return { css: "nsfw", label: settings.store.nsfwBadgeLabel, color: settings.store.nsfwBadgeColor };
        case 6101:
            return { css: "locked", label: settings.store.lockedBadgeLabel, color: settings.store.lockedBadgeColor };
        case 6102:
            return { css: "rules", label: settings.store.rulesBadgeLabel, color: settings.store.rulesBadgeColor };
        default:
            return { css: "unknown", label: settings.store.unknownBadgeLabel, color: settings.store.unknownBadgeColor };
    }
}
