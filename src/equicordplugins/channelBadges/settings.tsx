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
    showRulesThreadBadge: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Show Rules Thread badge",
        onChange: reloadBadges,
    },
    showPublicThreadBadge: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Show Public Thread badge",
        onChange: reloadBadges,
    },
    showAnnouncementChannelBadge: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Show Announcement Channel badge",
        onChange: reloadBadges,
    },

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
    rulesThreadBadgeLabel: {
        type: OptionType.STRING,
        default: "Rules",
        description: "Rules Thread badge label",
        onChange: reloadBadges,
    },
    publicThreadBadgeLabel: {
        type: OptionType.STRING,
        default: "Thread",
        description: "Public Thread badge label",
        onChange: reloadBadges,
    },
    announcementChannelBadgeLabel: {
        type: OptionType.STRING,
        default: "Announcement",
        description: "Announcement Channel badge label",
        onChange: reloadBadges,
    },
    nsfwBadgeColor: {
        type: OptionType.STRING,
        description: "NSFW badge color",
        onChange: reloadBadges,
    },
    lockedBadgeColor: {
        type: OptionType.STRING,
        description: "Locked badge color",
        onChange: reloadBadges,
    },
    textBadgeColor: {
        type: OptionType.STRING,
        description: "Text badge color",
        onChange: reloadBadges,
    },
    voiceBadgeColor: {
        type: OptionType.STRING,
        description: "Voice badge color",
        onChange: reloadBadges,
    },
    categoryBadgeColor: {
        type: OptionType.STRING,
        description: "Category badge color",
        onChange: reloadBadges,
    },
    directoryBadgeColor: {
        type: OptionType.STRING,
        description: "Directory badge color",
        onChange: reloadBadges,
    },
    threadBadgeColor: {
        type: OptionType.STRING,
        description: "Thread badge color",
        onChange: reloadBadges,
    },
    privateThreadBadgeColor: {
        type: OptionType.STRING,
        description: "Private Thread badge color",
        onChange: reloadBadges,
    },
    stageBadgeColor: {
        type: OptionType.STRING,
        description: "Stage badge color",
        onChange: reloadBadges,
    },
    announcementBadgeColor: {
        type: OptionType.STRING,
        description: "Announcement badge color",
        onChange: reloadBadges,
    },
    forumBadgeColor: {
        type: OptionType.STRING,
        description: "Forum badge color",
        onChange: reloadBadges,
    },
    unknownBadgeColor: {
        type: OptionType.STRING,
        description: "Unknown badge color",
        onChange: reloadBadges,
    },
    rulesThreadBadgeColor: {
        type: OptionType.STRING,
        description: "Rules Thread badge color",
        onChange: reloadBadges,
    },
    publicThreadBadgeColor: {
        type: OptionType.STRING,
        description: "Public Thread badge color",
        onChange: reloadBadges,
    },
    announcementChannelBadgeColor: {
        type: OptionType.STRING,
        description: "Announcement Channel badge color",
        onChange: reloadBadges,
    },
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
    showRulesThreadBadge: true,
    showPublicThreadBadge: true,

    channelBadges: {
        text: "Text",
        voice: "Voice",
        stage: "Stage",
        announcement: "Ads",
        forum: "Forum",
        public_thread: "Thread",
        private_thread: "Private Thread",
        rules: "Rules",
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
            return fromValues.showRulesThreadBadge;
        default:
            return fromValues.showUnknownBadge;
    }
}

function returnChannelBadge(type: number) {
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
            return { css: "thread", label: settings.store.publicThreadBadgeLabel, color: settings.store.publicThreadBadgeColor };
        case 11:
            return { css: "private_thread", label: settings.store.privateThreadBadgeLabel, color: settings.store.privateThreadBadgeColor };
        case 13:
            return { css: "stage", label: settings.store.stageBadgeLabel, color: settings.store.stageBadgeColor };
        case 14:
            return { css: "directory", label: settings.store.directoryBadgeLabel, color: settings.store.directoryBadgeColor };
        case 15:
            return { css: "forum", label: settings.store.forumBadgeLabel, color: settings.store.forumBadgeColor };
        case 6100:
            return { css: "nsfw", label: settings.store.nsfwBadgeLabel, color: settings.store.nsfwBadgeColor };
        case 6101:
            return { css: "locked", label: settings.store.lockedBadgeLabel, color: settings.store.lockedBadgeColor };
        case 6102:
            return { css: "rules", label: settings.store.rulesThreadBadgeLabel, color: settings.store.rulesThreadBadgeColor };
        default:
            return { css: "unknown", label: settings.store.unknownBadgeLabel, color: settings.store.unknownBadgeColor };
    }
}

export { settings, defaultValues, isEnabled, returnChannelBadge };