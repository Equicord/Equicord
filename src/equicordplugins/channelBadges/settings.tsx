import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

import { reloadBadges } from "./index";

const settings = definePluginSettings({
    oneBadgePerChannel: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Show only one badge per channel",
        onChange: reloadBadges,
    },
    showNSFWBadge: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Show NSFW badge",
        onChange: reloadBadges,
    },
    showLockedBadge: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Show Locked badge",
        onChange: reloadBadges,
    },
    showTextBadge: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Show Text badge",
        onChange: reloadBadges,
    },
    showVoiceBadge: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Show Voice badge",
        onChange: reloadBadges,
    },
    showCategoryBadge: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Show Category badge",
        onChange: reloadBadges,
    },
    showDirectoryBadge: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Show Directory badge",
        onChange: reloadBadges,
    },
    showThreadBadge: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Show Thread badge",
        onChange: reloadBadges,
    },
    showPrivateThreadBadge: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Show Private Thread badge",
        onChange: reloadBadges,
    },
    showStageBadge: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Show Stage badge",
        onChange: reloadBadges,
    },
    showAnnouncementBadge: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Show Announcement badge",
        onChange: reloadBadges,
    },
    showForumBadge: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Show Forum badge",
        onChange: reloadBadges,
    },
    showUnknownBadge: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Show Unknown badge",
        onChange: reloadBadges,
    },
    showNewsThreadBadge: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Show News Thread badge",
        onChange: reloadBadges,
    },
    showPublicThreadBadge: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Show Public Thread badge",
        onChange: reloadBadges,
    },
    showStoreBadge: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Show Store badge",
        onChange: reloadBadges,
    },
    showAnnouncementChannelBadge: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Show Announcement Channel badge",
        onChange: reloadBadges,
    },

    // Labels for badges
    nsfwBadgeLabel: {
        type: OptionType.STRING,
        default: "NSFW",
        description: "NSFW badge label",
        onChange: reloadBadges,
    },
    lockedBadgeLabel: {
        type: OptionType.STRING,
        default: "Locked",
        description: "Locked badge label",
        onChange: reloadBadges,
    },
    textBadgeLabel: {
        type: OptionType.STRING,
        default: "Text",
        description: "Text badge label",
        onChange: reloadBadges,
    },
    voiceBadgeLabel: {
        type: OptionType.STRING,
        default: "Voice",
        description: "Voice badge label",
        onChange: reloadBadges,
    },
    categoryBadgeLabel: {
        type: OptionType.STRING,
        default: "Category",
        description: "Category badge label",
        onChange: reloadBadges,
    },
    directoryBadgeLabel: {
        type: OptionType.STRING,
        default: "Directory",
        description: "Directory badge label",
        onChange: reloadBadges,
    },
    threadBadgeLabel: {
        type: OptionType.STRING,
        default: "Thread",
        description: "Thread badge label",
        onChange: reloadBadges,
    },
    privateThreadBadgeLabel: {
        type: OptionType.STRING,
        default: "Private Thread",
        description: "Private Thread badge label",
        onChange: reloadBadges,
    },
    stageBadgeLabel: {
        type: OptionType.STRING,
        default: "Stage",
        description: "Stage badge label",
        onChange: reloadBadges,
    },
    announcementBadgeLabel: {
        type: OptionType.STRING,
        default: "Ads",
        description: "Announcement badge label",
        onChange: reloadBadges,
    },
    forumBadgeLabel: {
        type: OptionType.STRING,
        default: "Forum",
        description: "Forum badge label",
        onChange: reloadBadges,
    },
    unknownBadgeLabel: {
        type: OptionType.STRING,
        default: "Unknown",
        description: "Unknown badge label",
        onChange: reloadBadges,
    },
    newsThreadBadgeLabel: {
        type: OptionType.STRING,
        default: "News",
        description: "News Thread badge label",
        onChange: reloadBadges,
    },
    publicThreadBadgeLabel: {
        type: OptionType.STRING,
        default: "Thread",
        description: "Public Thread badge label",
        onChange: reloadBadges,
    },
    storeBadgeLabel: {
        type: OptionType.STRING,
        default: "Store",
        description: "Store badge label",
        onChange: reloadBadges,
    },
    announcementChannelBadgeLabel: {
        type: OptionType.STRING,
        default: "Announcement",
        description: "Announcement Channel badge label",
        onChange: reloadBadges,
    }
});

const defaultValues = {
    showNSFWBadge: true,
    showLockedBadge: true,
    showTextBadge: true,
    showVoiceBadge: true,
    showCategoryBadge: true,
    showDirectoryBadge: true,
    showThreadBadge: true,
    showPrivateThreadBadge: true,
    showStageBadge: true,
    showAnnouncementBadge: true,
    showForumBadge: true,
    showUnknownBadge: true,
    showNewsThreadBadge: true,
    showPublicThreadBadge: true,

    channelBadges: {
        text: "Text",
        voice: "Voice",
        stage: "Stage",
        announcement: "Ads",
        forum: "Forum",
        public_thread: "Thread",
        private_thread: "Private Thread",
        news_thread: "News",
        category: "Category",
        directory: "Directory",
        nsfw: "NSFW",
        locked: "Locked",
    },
    lockedBadgeTooltip: "This channel is locked.",
    nsfwBadgeTooltip: "This channel is marked as NSFW.",
};

function isEnabled(type: number) {
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
        case 6:
            return fromValues.showStoreBadge;
        case 10:
            return fromValues.showPublicThreadBadge;
        case 11:
            return fromValues.showPrivateThreadBadge;
        case 12:
            return fromValues.showStageBadge;
        case 13:
            return fromValues.showAnnouncementChannelBadge;
        case 14:
            return fromValues.showDirectoryBadge;
        case 15:
            return fromValues.showForumBadge;
        case 6100:
            return fromValues.showNSFWBadge;
        case 6101:
            return fromValues.showLockedBadge;
        case 6102:
            return fromValues.showNewsThreadBadge;
        default:
            return fromValues.showUnknownBadge;
    }
}

function returnChannelBadge(type: number) {
    switch (type) {
        case 0:
            return { css: "text", label: settings.store.textBadgeLabel };
        case 2:
            return { css: "voice", label: settings.store.voiceBadgeLabel };
        case 4:
            return { css: "category", label: settings.store.categoryBadgeLabel };
        case 5:
            return { css: "announcement", label: settings.store.announcementBadgeLabel };
        case 6:
            return { css: "store", label: settings.store.storeBadgeLabel };
        case 10:
            return { css: "thread", label: settings.store.publicThreadBadgeLabel };
        case 11:
            return { css: "private_thread", label: settings.store.privateThreadBadgeLabel };
        case 13:
            return { css: "stage", label: settings.store.stageBadgeLabel };
        case 14:
            return { css: "directory", label: settings.store.directoryBadgeLabel };
        case 15:
            return { css: "forum", label: settings.store.forumBadgeLabel };
        case 6100:
            return { css: "nsfw", label: settings.store.nsfwBadgeLabel };
        case 6101:
            return { css: "locked", label: settings.store.lockedBadgeLabel };
        case 6102:
            return { css: "news_thread", label: settings.store.newsThreadBadgeLabel };
        default:
            return { css: "unknown", label: settings.store.unknownBadgeLabel };
    }
}

export { settings, defaultValues, isEnabled, returnChannelBadge };