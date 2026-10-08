/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Quest } from "@vencord/discord-types";
import { QuestTaskType } from "@vencord/discord-types/enums";

import { getQuestifySettings } from "../settings/access";
import { autoCompleteQuestTaskTypes, isDesktopCompatible, type QuestButtonIncludedTypes } from "../settings/def";
import { getIgnoredQuestIDs } from "../settings/ignoredQuests";
import { getQuestStatus, QuestStatus, type QuestTask } from "./questState";

export const desktopVideoCompatibilityTasks = new WeakSet<QuestTask>();

export function getEffectiveQuestTaskType(task: QuestTask): QuestTaskType {
    return desktopVideoCompatibilityTasks.has(task) ? QuestTaskType.WATCH_VIDEO_ON_MOBILE : task.type;
}

export function isAutoCompleteQuestTaskEnabled(task: QuestTask): boolean {
    const type = getEffectiveQuestTaskType(task);
    return autoCompleteQuestTaskTypes.some(taskType => taskType === task.type)
        && isDesktopCompatible(type)
        && getQuestifySettings().autoCompleteQuestTypes[type] === true;
}

export function filterQuestPage(quests: Quest[], tab: string): Quest[] {
    const settings = getQuestifySettings();
    if (tab !== "all") return quests;

    const hiddenStatuses = new Set<QuestStatus>();
    if (settings.hideUnclaimedQuests) hiddenStatuses.add(QuestStatus.Unclaimed);
    if (settings.hideClaimedQuests) hiddenStatuses.add(QuestStatus.Claimed);
    if (settings.hideIgnoredQuests) hiddenStatuses.add(QuestStatus.Ignored);
    if (settings.hideExpiredQuests) hiddenStatuses.add(QuestStatus.Expired);
    if (!settings.filterQuestPage && !settings.hideNonAutoCompletableQuests && hiddenStatuses.size === 0) return quests;

    const ignoredQuestIds = getIgnoredQuestIDs();
    return quests.filter(quest =>
        (hiddenStatuses.size === 0 || !hiddenStatuses.has(getQuestStatus(quest, ignoredQuestIds)))
        && (!settings.filterQuestPage || (!ignoredQuestIds.includes(quest.id) && questMatchesIncludedTypes(quest, settings.questButtonIncludedTypes)))
        && (!settings.hideNonAutoCompletableQuests || !!quest.userStatus?.completedAt
            || Object.values(quest.config.taskConfigV2.tasks).some(isAutoCompleteQuestTaskEnabled))
    );
}

export function getNewQuests(currentQuests: Quest[], nextQuests: Quest[]): Quest[] {
    const currentQuestIds = new Set(currentQuests.map(quest => quest.id));

    return nextQuests.filter(quest => !currentQuestIds.has(quest.id));
}

export function questMatchesIncludedTypes(quest: Quest, includedTypes: QuestButtonIncludedTypes): boolean {
    const rewardTypeAllowed = quest.config.rewardsConfig.rewards.some(reward => Boolean(includedTypes[reward.type]));
    const taskTypeAllowed = Object.values(quest.config.taskConfigV2.tasks).some(task => Boolean(includedTypes[getEffectiveQuestTaskType(task)]));

    return rewardTypeAllowed && taskTypeAllowed;
}

export function normalizeQuestName(quest: Quest): string {
    const normalized = quest.config.messages.questName.trim().toUpperCase();
    return normalized.replace(/(?:^|\s)QUEST$/, "").trim();
}

export function countIncludedUnclaimedQuests(
    quests: Quest[],
    ignoredQuestIds: ReadonlyArray<string>,
    includedTypes: QuestButtonIncludedTypes,
): number {
    let count = 0;

    for (const quest of quests) {
        const questStatus = getQuestStatus(quest, ignoredQuestIds);

        if (questStatus === QuestStatus.Unclaimed && questMatchesIncludedTypes(quest, includedTypes)) {
            count++;
        }
    }

    return count;
}
