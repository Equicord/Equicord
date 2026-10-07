/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Quest } from "@vencord/discord-types";
import { QuestTaskType } from "@vencord/discord-types/enums";

import { getQuestifySettings } from "../settings/access";
import type { QuestButtonIncludedTypes } from "../settings/def";
import { getIgnoredQuestIDs } from "../settings/ignoredQuests";
import type { QuestTask } from "./questState";

export const desktopVideoCompatibilityTasks = new WeakSet<QuestTask>();

export function getEffectiveQuestTaskType(task: QuestTask): QuestTaskType {
    return desktopVideoCompatibilityTasks.has(task) ? QuestTaskType.WATCH_VIDEO_ON_MOBILE : task.type;
}

export function filterQuestPage(quests: Quest[], tab: string): Quest[] {
    const { filterQuestPage, hideClaimedQuests, questButtonIncludedTypes } = getQuestifySettings();
    if (tab !== "all" || (!filterQuestPage && !hideClaimedQuests)) return quests;

    const ignoredQuestIds = new Set(filterQuestPage ? getIgnoredQuestIDs() : []);
    return quests.filter(quest =>
        (!hideClaimedQuests || !quest.userStatus?.claimedAt)
        && (!filterQuestPage || (!ignoredQuestIds.has(quest.id) && questMatchesIncludedTypes(quest, questButtonIncludedTypes)))
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
