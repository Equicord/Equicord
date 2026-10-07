/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings, PlainSettings, SettingsStore } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { OptionType } from "@utils/types";

import { QuestFeaturesSetting } from "../components/questFeaturesSetting";
import { startAutoFetchingQuests } from "../utils/fetching";
import { defaultAcknowledgedNotices, defaultAllowChangingDangerousSettings, defaultAutoCompleteQuestsSimultaneously, defaultAutoCompleteQuestTypes, defaultClaimedSubsort, defaultCompleteVideoQuestsQuicker, defaultExpiredSubsort, defaultIgnoredQuestIDs, defaultIgnoredSubsort, defaultLastQuestPageFilters, defaultMakeMobileVideoQuestsDesktopCompatible, defaultPreventVideoQuestsPausing, defaultQuestButtonBadgeColor, defaultQuestButtonIncludedTypes, defaultQuestOrder, defaultQuestTileClaimedColorSetting, defaultQuestTileExpiredColorSetting, defaultQuestTileIgnoredColorSetting, defaultQuestTileUnclaimedColorSetting, defaultResumeInterruptedQuests, defaultResumeQuestIDs, defaultUnclaimedSubsort, type QuestButtonAction, type QuestButtonDisplayMode, type QuestButtonIncludedTypes, type QuestButtonIndicatorMode, type QuestOrderStatus } from "./def";
import { rerenderQuests } from "./rerender";

const refreshAutoFetchingQuests = () => startAutoFetchingQuests(true);

const MIGRATION_TARGET = 1;
const CURRENT_SETTINGS = PlainSettings.plugins.Questify;

if (CURRENT_SETTINGS) {
    let migrationVersion = CURRENT_SETTINGS.migrationVersion ?? 0;

    // 0 -> 1: Reset Settings
    if (migrationVersion === 0) {
        PlainSettings.plugins.Questify = { enabled: CURRENT_SETTINGS.enabled, migrationVersion: 1 };
        migrationVersion = 1;
    }

    if (migrationVersion !== CURRENT_SETTINGS.migrationVersion) {
        SettingsStore.markAsChanged();
    }
}

export const settings = definePluginSettings({
    migrationVersion: {
        type: OptionType.NUMBER,
        description: "The current migration version of the settings.",
        default: MIGRATION_TARGET,
        hidden: true,
    },
    acknowledgedNotices: {
        type: OptionType.CUSTOM,
        description: "One-time notices that the user has acknowledged.",
        default: { ...defaultAcknowledgedNotices },
        hidden: true,
    },
    questFeatures: {
        type: OptionType.COMPONENT,
        component: ErrorBoundary.wrap(QuestFeaturesSetting) as any,
        description: "Configure Questify.",
    },
    disableQuestsEverything: {
        type: OptionType.BOOLEAN,
        description: "Disable all Quest features.",
        default: false,
        onChange: refreshAutoFetchingQuests,
        restartNeeded: true,
        hidden: true,
    },
    disableRelocationNotices: {
        type: OptionType.BOOLEAN,
        description: "Disable Quest relocation notices in the Discovery page.",
        default: true,
        restartNeeded: true,
        hidden: true,
    },
    disableSponsoredBanner: {
        type: OptionType.BOOLEAN,
        description: "Disable the sponsored banner on the Quest page.",
        default: false,
        restartNeeded: true,
        hidden: true,
    },
    disableAccountPanelPromo: {
        type: OptionType.BOOLEAN,
        description: "Disable the promoted Quest popup above your account panel.",
        default: true,
        restartNeeded: true,
        hidden: true,
    },
    disableAccountPanelQuestProgress: {
        type: OptionType.BOOLEAN,
        description: "Disable active and completed Quest progress above your account panel.",
        default: false,
        restartNeeded: true,
        hidden: true,
    },
    disableOrbsAndQuestsBadges: {
        type: OptionType.BOOLEAN,
        description: "Disable the Quest badge on user profiles.",
        default: false,
        restartNeeded: true,
        hidden: true,
    },
    disableFriendsListPromo: {
        type: OptionType.BOOLEAN,
        description: "Disable the promotion of Quests for games played by friends.",
        default: true,
        restartNeeded: true,
        hidden: true,
    },
    disableMembersListPromo: {
        type: OptionType.BOOLEAN,
        description: "Disable the actively playing icon in members list items.",
        default: true,
        restartNeeded: true,
        hidden: true,
    },
    allowChangingDangerousSettings: {
        type: OptionType.BOOLEAN,
        description: "Allow changing dangerous settings.",
        default: defaultAllowChangingDangerousSettings,
        hidden: true,
    },
    resumeInterruptedQuests: {
        type: OptionType.BOOLEAN,
        description: "Resume auto-completing Quests after a reload or restart.",
        default: defaultResumeInterruptedQuests,
        restartNeeded: true,
        hidden: true,
    },
    makeMobileVideoQuestsDesktopCompatible: {
        type: OptionType.BOOLEAN,
        description: "Make mobile-only Video Quests compatible with desktop.",
        default: defaultMakeMobileVideoQuestsDesktopCompatible,
        restartNeeded: true,
        hidden: true,
    },
    autoCompleteQuestsSimultaneously: {
        type: OptionType.BOOLEAN,
        description: "Complete Quests simultaneously rather than sequentially.",
        default: defaultAutoCompleteQuestsSimultaneously,
        restartNeeded: true,
        hidden: true,
    },
    completeVideoQuestsQuicker: {
        type: OptionType.BOOLEAN,
        description: "Use Discord's progress leeway and elapsed enrollment time for Video Quest auto-completion.",
        default: defaultCompleteVideoQuestsQuicker,
        restartNeeded: true,
        hidden: true,
    },
    preventVideoQuestsPausing: {
        type: OptionType.BOOLEAN,
        description: "Prevent pausing the video when the Quest modal loses focus.",
        default: defaultPreventVideoQuestsPausing,
        restartNeeded: true,
        hidden: true,
    },
    autoCompleteQuestTypes: {
        type: OptionType.CUSTOM,
        description: "Which types of Quests to auto-complete in the background.",
        default: defaultAutoCompleteQuestTypes,
        restartNeeded: true,
        hidden: true,
    },
    questButtonDisplay: {
        type: OptionType.CUSTOM,
        description: "Which display type to use for the Quest button in the server list.",
        default: "always" as QuestButtonDisplayMode,
        onChange: refreshAutoFetchingQuests,
        restartNeeded: true,
        hidden: true,
    },
    questButtonIncludedTypes: {
        type: OptionType.CUSTOM,
        description: "Reward and task types included in the Quest button, notifications, and optional page filtering.",
        default: defaultQuestButtonIncludedTypes as QuestButtonIncludedTypes,
        hidden: true,
    },
    questButtonIndicator: {
        type: OptionType.CUSTOM,
        description: "Which display type to use for the unclaimed indicator on the Quest button in the server list.",
        default: "both" as QuestButtonIndicatorMode,
        onChange: refreshAutoFetchingQuests,
        hidden: true,
    },
    questButtonBadgeCount: {
        type: OptionType.NUMBER,
        description: "The current number of relevant unclaimed Quests.",
        default: 0,
        hidden: true,
    },
    questButtonBadgeColor: {
        type: OptionType.NUMBER | OptionType.CUSTOM,
        description: "The color of the Quest button badge in the server list.",
        default: defaultQuestButtonBadgeColor as number | null,
        hidden: true,
    },
    questButtonLeftClickAction: {
        type: OptionType.CUSTOM,
        description: "The action to perform when left-clicking the Quest button in the server list.",
        default: "open-quests" as QuestButtonAction,
        hidden: true,
    },
    questButtonMiddleClickAction: {
        type: OptionType.CUSTOM,
        description: "The action to perform when middle-clicking the Quest button in the server list.",
        default: "plugin-settings" as QuestButtonAction,
        hidden: true,
    },
    questButtonRightClickAction: {
        type: OptionType.CUSTOM,
        description: "The action to perform when right-clicking the Quest button in the server list.",
        default: "context-menu" as QuestButtonAction,
        hidden: true,
    },
    notifyOnQuestComplete: {
        type: OptionType.BOOLEAN,
        description: "Show a notification when a Quest is completed.",
        default: true,
        hidden: true,
    },
    notifyOnNewQuests: {
        type: OptionType.BOOLEAN,
        description: "Show a notification when new Quests are detected.",
        default: true,
        onChange: refreshAutoFetchingQuests,
        hidden: true,
    },
    notifyOnNewExcludedQuests: {
        type: OptionType.BOOLEAN,
        description: "Show a notification when new excluded Quests are detected.",
        default: false,
        onChange: refreshAutoFetchingQuests,
        hidden: true,
    },
    questCompletedAlertSound: {
        type: OptionType.STRING | OptionType.CUSTOM,
        description: "The sound to play when a Quest is completed.",
        default: "bop_message1" as string | null,
        hidden: true,
    },
    questCompletedAlertVolume: {
        type: OptionType.NUMBER,
        description: "The volume for the Quest completed alert sound.",
        default: 100,
        hidden: true,
    },
    questFetchInterval: {
        type: OptionType.NUMBER,
        description: "The interval in seconds to fetch Quests from Discord.",
        default: 2700,
        onChange: refreshAutoFetchingQuests,
        hidden: true,
    },
    newQuestAlertSound: {
        type: OptionType.STRING | OptionType.CUSTOM,
        description: "The sound to play when new Quests are detected.",
        default: "discodo" as string | null,
        onChange: refreshAutoFetchingQuests,
        hidden: true,
    },
    newQuestAlertVolume: {
        type: OptionType.NUMBER,
        description: "The volume for the new Quest alert sound.",
        default: 100,
        hidden: true,
    },
    newExcludedQuestAlertSound: {
        type: OptionType.STRING | OptionType.CUSTOM,
        description: "The sound to play when new excluded Quests are detected.",
        default: null as string | null,
        onChange: refreshAutoFetchingQuests,
        hidden: true,
    },
    newExcludedQuestAlertVolume: {
        type: OptionType.NUMBER,
        description: "The volume for the new excluded Quest alert sound.",
        default: 100,
        hidden: true,
    },
    filterQuestPage: {
        type: OptionType.BOOLEAN,
        description: "Hide ignored Quests and apply the Quest button's included reward and task types to the Quests page.",
        default: false,
        restartNeeded: false,
        onChange: rerenderQuests,
        hidden: true,
    },
    hideClaimedQuests: {
        type: OptionType.BOOLEAN,
        description: "Hide claimed Quests on the main Quests page while keeping them in the Claimed tab.",
        default: false,
        restartNeeded: false,
        onChange: rerenderQuests,
        hidden: true,
    },
    questTileUnclaimedColor: {
        type: OptionType.CUSTOM,
        description: "The color of unclaimed Quest tiles in the Quests page.",
        default: { ...defaultQuestTileUnclaimedColorSetting },
        hidden: true,
    },
    questTileClaimedColor: {
        type: OptionType.CUSTOM,
        description: "The color of claimed Quest tiles in the Quests page.",
        default: { ...defaultQuestTileClaimedColorSetting },
        hidden: true,
    },
    questTileIgnoredColor: {
        type: OptionType.CUSTOM,
        description: "The color of ignored Quest tiles in the Quests page.",
        default: { ...defaultQuestTileIgnoredColorSetting },
        hidden: true,
    },
    questTileExpiredColor: {
        type: OptionType.CUSTOM,
        description: "The color of expired Quest tiles in the Quests page.",
        default: { ...defaultQuestTileExpiredColorSetting },
        hidden: true,
    },
    questTileGradient: {
        type: OptionType.STRING,
        description: "Style of the gradient used in the Quest tiles.",
        default: "intense",
        hidden: true,
    },
    questTilePreload: {
        type: OptionType.BOOLEAN,
        description: "Attempt to preload the assets for the Quest tiles.",
        default: true,
        hidden: true,
    },
    questOrder: {
        type: OptionType.CUSTOM,
        description: "Sort order for Quest status groups.",
        default: Array.from(defaultQuestOrder) as QuestOrderStatus[],
        hidden: true,
    },
    unclaimedSubsort: {
        type: OptionType.STRING,
        description: "Subsort method for unclaimed Quests.",
        default: defaultUnclaimedSubsort,
        hidden: true,
    },
    claimedSubsort: {
        type: OptionType.STRING,
        description: "Subsort method for claimed Quests.",
        default: defaultClaimedSubsort,
        hidden: true,
    },
    ignoredSubsort: {
        type: OptionType.STRING,
        description: "Subsort method for ignored Quests.",
        default: defaultIgnoredSubsort,
        hidden: true,
    },
    expiredSubsort: {
        type: OptionType.STRING,
        description: "Subsort method for expired Quests.",
        default: defaultExpiredSubsort,
        hidden: true,
    },
    isOnQuestsPage: {
        type: OptionType.BOOLEAN,
        description: "Whether the user is currently on the Quests page.",
        default: false,
        hidden: true,
    },
    rememberQuestPageSort: {
        type: OptionType.BOOLEAN,
        description: "Remember the last used sort on the Quests page.",
        default: true,
        hidden: true,
    },
    rememberQuestPageFilters: {
        type: OptionType.BOOLEAN,
        description: "Remember the last used filters on the Quests page.",
        default: true,
        hidden: true,
    },
    lastQuestPageSort: {
        type: OptionType.STRING,
        description: "Remember the last used sort on the Quests page.",
        default: "questify",
        hidden: true,
    },
    lastQuestPageFilters: {
        type: OptionType.CUSTOM,
        description: "Remember the last used filters on the Quests page.",
        default: defaultLastQuestPageFilters,
        hidden: true,
    },
    ignoredQuestIDs: {
        type: OptionType.CUSTOM,
        description: "An array of Quest IDs that are ignored.",
        default: defaultIgnoredQuestIDs,
        hidden: true,
    },
    resumeQuestIDs: {
        type: OptionType.CUSTOM,
        description: "An array of Quest IDs that are being or are queued to be auto-completed in the background.",
        default: defaultResumeQuestIDs,
        hidden: true,
    },
});
