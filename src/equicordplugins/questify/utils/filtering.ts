/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Quest } from "@vencord/discord-types";
import { QuestRewardType, QuestTaskJoinOperator, QuestTaskType } from "@vencord/discord-types/enums";
import { QuestStore } from "@webpack/common";

import { autoCompleteQuestTaskTypes, getQuestCombinationKey, parseQuestCombinationKey } from "../settings/def";
import { isInjectedDesktopVideoTask } from "../state";
import { getQuestAutoCompleteEntry } from "./completion";

const autoCompleteQuestTaskTypeSet = new Set<QuestTaskType>(autoCompleteQuestTaskTypes);

export type QuestTermField = "all" | "questName" | "gameTitle" | "gamePublisher";

export interface ParsedQuestTerm {
    field: QuestTermField;
    value: string;
}

const questTermPrefixFields: Record<string, Exclude<QuestTermField, "all">> = {
    name: "questName",
    quest: "questName",
    game: "gameTitle",
    title: "gameTitle",
    pub: "gamePublisher",
    publisher: "gamePublisher",
};

function toCanonicalCombinationSet(combinations: readonly string[]): Set<string> {
    const canonical = new Set<string>();

    for (const key of combinations ?? []) {
        const parsed = parseQuestCombinationKey(key);

        if (parsed) {
            canonical.add(getQuestCombinationKey(parsed.rewardType, parsed.taskType));
        }
    }

    return canonical;
}

export function getNewQuests(currentQuests: Quest[], nextQuests: Quest[]): Quest[] {
    const currentQuestIds = new Set(currentQuests.map(quest => quest.id));

    return nextQuests.filter(quest => !currentQuestIds.has(quest.id));
}

export function getQuestRewardTypes(quest: Quest): QuestRewardType[] {
    return quest.config.rewardsConfig?.rewards.map(reward => reward.type) ?? [];
}

export function getQuestOriginalTaskTypes(quest: Quest): QuestTaskType[] {
    const tasks = quest.config.taskConfigV2?.tasks;

    if (!tasks) {
        return [];
    }

    return Object.values(tasks)
        .filter(task => !isInjectedDesktopVideoTask(task))
        .map(task => task.type);
}

export function parseExcludedQuestTerms(rawTerms: string): ParsedQuestTerm[] {
    const parsed: ParsedQuestTerm[] = [];

    for (const entry of rawTerms.split(",")) {
        const trimmed = entry.trim().toLowerCase();

        if (!trimmed) {
            continue;
        }

        const colonIndex = trimmed.indexOf(":");

        if (colonIndex > 0) {
            const prefix = trimmed.slice(0, colonIndex);
            const field = Object.hasOwn(questTermPrefixFields, prefix) ? questTermPrefixFields[prefix] : null;

            if (field) {
                const value = trimmed.slice(colonIndex + 1).trim();

                if (value) {
                    parsed.push({ field, value });
                }

                continue;
            }
        }

        parsed.push({ field: "all", value: trimmed });
    }

    return parsed;
}

export function questMatchesCombinations(quest: Quest, combinations: readonly string[]): boolean {
    if (!combinations?.length) {
        return false;
    }

    const rewardTypes = getQuestRewardTypes(quest);
    const taskTypes = getQuestOriginalTaskTypes(quest);

    if (rewardTypes.length === 0 || taskTypes.length === 0) {
        return false;
    }

    const combinationSet = toCanonicalCombinationSet(combinations);
    const requiresAllTasks = quest.config.taskConfigV2?.joinOperator === QuestTaskJoinOperator.AND;

    return rewardTypes.every(rewardType => (
        requiresAllTasks
            ? taskTypes.some(taskType => combinationSet.has(getQuestCombinationKey(rewardType, taskType)))
            : taskTypes.every(taskType => combinationSet.has(getQuestCombinationKey(rewardType, taskType)))
    ));
}

export function questMatchesExcludedTerms(quest: Quest, rawTerms: string): boolean {
    const terms = parseExcludedQuestTerms(rawTerms);

    if (terms.length === 0) {
        return false;
    }

    const fields = {
        questName: quest.config.messages?.questName?.toLowerCase() ?? "",
        gameTitle: quest.config.messages?.gameTitle?.toLowerCase() ?? "",
        gamePublisher: quest.config.messages?.gamePublisher?.toLowerCase() ?? "",
    };

    return terms.some(({ field, value }) => (
        field === "all"
            ? fields.questName.includes(value) || fields.gameTitle.includes(value) || fields.gamePublisher.includes(value)
            : fields[field].includes(value)
    ));
}

export function hasQuestOptimisticProgress(quest: Quest): boolean {
    const taskTypes = new Set<string>(Object.keys(quest.config.taskConfigV2?.tasks ?? {}));

    if (taskTypes.has(QuestTaskType.WATCH_VIDEO) || taskTypes.has(QuestTaskType.WATCH_VIDEO_ON_MOBILE)) {
        taskTypes.add(QuestTaskType.WATCH_VIDEO);
        taskTypes.add(QuestTaskType.WATCH_VIDEO_ON_MOBILE);
    }

    return Array.from(taskTypes).some(taskType => (QuestStore.getOptimisticProgress?.(quest.id, taskType) ?? 0) > 0);
}

function hasQuestUserProgress(quest: Quest): boolean {
    const { userStatus } = quest;

    if (!userStatus) {
        return false;
    }

    if (userStatus.completedAt || userStatus.claimedAt || userStatus.streamProgressSeconds > 0) {
        return true;
    }

    if (Object.values(userStatus.progress ?? {}).some(progress => (typeof progress?.value === "number" && progress.value > 0) || Boolean(progress?.completedAt))) {
        return true;
    }

    return hasQuestOptimisticProgress(quest);
}

export function isQuestExemptFromRelevancy(quest: Quest): boolean {
    return hasQuestUserProgress(quest) || getQuestAutoCompleteEntry(quest) !== null;
}

export function isQuestHiddenByRelevancy(
    quest: Quest,
    combinations: readonly string[],
    rawTerms: string,
): boolean {
    if (isQuestExemptFromRelevancy(quest)) {
        return false;
    }

    return questMatchesCombinations(quest, combinations) || questMatchesExcludedTerms(quest, rawTerms);
}

export function isQuestNotificationPrevented(
    quest: Quest,
    combinations: readonly string[],
    rawTerms: string,
): boolean {
    if (isQuestExemptFromRelevancy(quest)) {
        return false;
    }

    return questMatchesCombinations(quest, combinations) || questMatchesExcludedTerms(quest, rawTerms);
}

export function questTaskMatchesAutoCompleteCombinations(
    quest: Quest,
    taskType: QuestTaskType,
    combinations: readonly string[],
): boolean {
    if (!combinations?.length) {
        return false;
    }

    const combinationSet = toCanonicalCombinationSet(combinations);

    return getQuestRewardTypes(quest).some(rewardType =>
        combinationSet.has(getQuestCombinationKey(rewardType, taskType))
    );
}

export function hasEnabledAutoCompleteCombinations(combinations: readonly string[]): boolean {
    return (combinations ?? []).some(key => {
        const parsed = parseQuestCombinationKey(key);

        return parsed !== null && autoCompleteQuestTaskTypeSet.has(parsed.taskType);
    });
}

export function hasEnabledAutoCompleteTaskType(combinations: readonly string[], taskType: QuestTaskType): boolean {
    return (combinations ?? []).some(key => {
        const parsed = parseQuestCombinationKey(key);

        return parsed !== null && parsed.taskType === taskType;
    });
}

export function normalizeQuestName(quest: Quest): string {
    const normalized = quest.config.messages.questName.trim().toUpperCase();
    return normalized.endsWith("QUEST") ? normalized.slice(0, -5).trim() : normalized;
}
