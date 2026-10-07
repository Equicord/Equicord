/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { QuestRewardType, QuestTaskType } from "@vencord/discord-types/enums";

export type QuestButtonDisplayMode = "always" | "unclaimed" | "never";
export type QuestButtonIndicatorMode = "pill" | "badge" | "both" | "none";
export type QuestButtonAction = "open-quests" | "context-menu" | "plugin-settings" | "nothing";
export type QuestTileGradient = "intense" | "default" | "black" | "hide";
export type QuestOrderStatus = "UNCLAIMED" | "CLAIMED" | "IGNORED" | "EXPIRED";
export type QuestSubsort = "Recent ASC" | "Recent DESC" | "Expiring ASC" | "Expiring DESC" | "Claimed ASC" | "Claimed DESC";
export interface QuestTileColorSetting {
    enabled: boolean;
    color: number;
}

export const defaultQuestTileUnclaimedColor = 2842239;
export const defaultQuestTileClaimedColor = 6105983;
export const defaultQuestTileIgnoredColor = 8334124;
export const defaultQuestTileExpiredColor = 2368553;
export const defaultQuestTileUnclaimedColorSetting: QuestTileColorSetting = { enabled: true, color: defaultQuestTileUnclaimedColor };
export const defaultQuestTileClaimedColorSetting: QuestTileColorSetting = { enabled: true, color: defaultQuestTileClaimedColor };
export const defaultQuestTileIgnoredColorSetting: QuestTileColorSetting = { enabled: true, color: defaultQuestTileIgnoredColor };
export const defaultQuestTileExpiredColorSetting: QuestTileColorSetting = { enabled: true, color: defaultQuestTileExpiredColor };
export const defaultQuestOrder = ["UNCLAIMED", "CLAIMED", "IGNORED", "EXPIRED"] as const satisfies readonly QuestOrderStatus[];

export const defaultQuestButtonBadgeColor = defaultQuestTileUnclaimedColor;

export const defaultResumeInterruptedQuests = false;
export const defaultAllowChangingDangerousSettings = false; // true -> Risky
export const defaultAcknowledgedNotices: Record<string, true> = {};
export const defaultMakeMobileVideoQuestsDesktopCompatible = false; // true -> Risky
export const defaultCompleteVideoQuestsQuicker = false; // true -> Risky
export const defaultPreventVideoQuestsPausing = false; // true -> Risky
export const defaultAutoCompleteQuestsSimultaneously = false; // true -> Risky

export const questTaskLabels = {
    [QuestTaskType.WATCH_VIDEO]: "Watch Video",
    [QuestTaskType.WATCH_VIDEO_ON_MOBILE]: "Watch Video on Mobile",
    [QuestTaskType.ACHIEVEMENT_IN_ACTIVITY]: "Achievement in Activity",
    [QuestTaskType.ACHIEVEMENT_IN_GAME]: "Achievement in Game",
    [QuestTaskType.PLAY_ACTIVITY]: "Play Activity",
    [QuestTaskType.PLAY_ON_DESKTOP]: "Play on Desktop",
    [QuestTaskType.PLAY_ON_DESKTOP_V2]: "Play on Desktop V2",
    [QuestTaskType.STREAM_ON_DESKTOP]: "Stream on Desktop",
    [QuestTaskType.PLAY_ON_PLAYSTATION]: "Play on PlayStation",
    [QuestTaskType.PLAY_ON_XBOX]: "Play on Xbox",
} as const satisfies Record<QuestTaskType, string>;

export const questTaskTypes = [
    QuestTaskType.WATCH_VIDEO,
    QuestTaskType.WATCH_VIDEO_ON_MOBILE,
    QuestTaskType.ACHIEVEMENT_IN_ACTIVITY,
    QuestTaskType.ACHIEVEMENT_IN_GAME,
    QuestTaskType.PLAY_ACTIVITY,
    QuestTaskType.PLAY_ON_DESKTOP,
    QuestTaskType.PLAY_ON_DESKTOP_V2,
    QuestTaskType.STREAM_ON_DESKTOP,
    QuestTaskType.PLAY_ON_PLAYSTATION,
    QuestTaskType.PLAY_ON_XBOX,
] as const satisfies readonly QuestTaskType[];

export const autoCompleteQuestTaskTypes = [
    QuestTaskType.PLAY_ON_DESKTOP,
    QuestTaskType.PLAY_ON_XBOX,
    QuestTaskType.PLAY_ON_PLAYSTATION,
    QuestTaskType.PLAY_ACTIVITY,
    QuestTaskType.WATCH_VIDEO,
    QuestTaskType.WATCH_VIDEO_ON_MOBILE,
    QuestTaskType.ACHIEVEMENT_IN_ACTIVITY,
] as const satisfies readonly QuestTaskType[];

const desktopOnlyAutoCompleteQuestTypes = new Set<QuestTaskType>([
    QuestTaskType.PLAY_ON_DESKTOP,
    QuestTaskType.PLAY_ON_PLAYSTATION,
    QuestTaskType.PLAY_ON_XBOX,
    QuestTaskType.PLAY_ACTIVITY,
]);

export function isDesktopCompatible(questType: QuestTaskType): boolean {
    if (questType === QuestTaskType.ACHIEVEMENT_IN_ACTIVITY) {
        return typeof VencordNative?.pluginHelpers?.Questify?.complete === "function";
    }

    return IS_DISCORD_DESKTOP || !desktopOnlyAutoCompleteQuestTypes.has(questType);
}

export type AutoCompleteQuestTypes = Partial<Record<QuestTaskType, boolean>>;

export const defaultAutoCompleteQuestTypes = Object.fromEntries(
    autoCompleteQuestTaskTypes.map(questType => [questType, false])
) as AutoCompleteQuestTypes;

export type QuestButtonIncludedTypes = Record<QuestTaskType | QuestRewardType, boolean>;

export const defaultQuestButtonIncludedTypes: QuestButtonIncludedTypes = {
    ...Object.fromEntries(questTaskTypes.map(questType => [questType, true])),
    [QuestRewardType.REWARD_CODE]: true,
    [QuestRewardType.IN_GAME]: true,
    [QuestRewardType.COLLECTIBLE]: true,
    [QuestRewardType.VIRTUAL_CURRENCY]: true,
    [QuestRewardType.FRACTIONAL_PREMIUM]: true,
} as QuestButtonIncludedTypes;

export const defaultUnclaimedSubsort: QuestSubsort = "Expiring ASC";
export const defaultClaimedSubsort: QuestSubsort = "Claimed DESC";
export const defaultIgnoredSubsort: QuestSubsort = "Recent DESC";
export const defaultExpiredSubsort: QuestSubsort = "Expiring DESC";
export const defaultLastQuestPageFilters = {} as Record<string, { group: string, filter: string; }>;
export const ignoredQuestIDsKey = "questIDs";
export const defaultIgnoredQuestIDs = { [ignoredQuestIDsKey]: [] } as Record<typeof ignoredQuestIDsKey, string[]>;
export const defaultResumeQuestIDs = {} as Record<string, // key: UserID
    { timestamp: number, questIDs: string[]; }>;
