/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Quest } from "@vencord/discord-types";
import { QuestTaskType } from "@vencord/discord-types/enums";
import { lodash, QuestStore } from "@webpack/common";

import { getQuestifySettings, useQuestifySettings } from "../settings/access";
import { questTaskTypes } from "../settings/def";
import { getIgnoredQuestIDs } from "../settings/ignoredQuests";
import { getActiveAutoCompletes, getAutoCompleteQuestTarget, getQuestAutoCompleteEntry } from "./completion";
import { getQuestStatus, getQuestStoredProgress, QuestStatus, type QuestTask, refreshQuest } from "./questState";

const showcaseSwitchLeewaySeconds = 3;
let showcasedAutoCompleteQuestId: string | null = null;

interface QuestPanelCreative {
    type: number;
    quest?: Quest;
}

interface QuestPanelPercentCompleteOptions {
    quest?: Quest | null;
    percentCompleteText?: string;
}

interface QuestPanelPercentCompleteResult {
    percentComplete: number;
    percentCompleteText?: string;
}

interface QuestEmbedProgressResult {
    completedRatio: number;
    completedRatioDisplay?: string;
}

interface QuestProgressEntry {
    eventName?: QuestTaskType;
    heartbeat?: { lastBeatAt?: string | null; } | null;
    updatedAt?: string | null;
}

function getQuestTaskByType(quest: Quest, taskType: QuestTaskType): QuestTask | null {
    const task = quest.config.taskConfigV2?.tasks[taskType] as QuestTask | undefined;

    return task ?? null;
}

function getVideoQuestTask(quest: Quest): QuestTask | null {
    return getQuestTaskByType(quest, QuestTaskType.WATCH_VIDEO)
        ?? getQuestTaskByType(quest, QuestTaskType.WATCH_VIDEO_ON_MOBILE);
}

function getProgressTimestamp(progress: QuestProgressEntry): number {
    const timestamp = progress.heartbeat?.lastBeatAt ?? progress.updatedAt;
    const time = timestamp ? new Date(timestamp).getTime() : 0;

    return Number.isFinite(time) ? time : 0;
}

function getLatestProgressTask(quest: Quest): QuestTask | null {
    const progressEntries = Object.entries(quest.userStatus?.progress ?? {}) as [QuestTaskType, QuestProgressEntry][];

    progressEntries.sort(([, a], [, b]) => getProgressTimestamp(b) - getProgressTimestamp(a));

    for (const [fallbackTaskType, progress] of progressEntries) {
        const task = getQuestTaskByType(quest, progress.eventName ?? fallbackTaskType);

        if (task) {
            return task;
        }
    }

    return null;
}

function getQuestProgressTask(quest: Quest): QuestTask | null {
    if (!quest.config.taskConfigV2?.tasks) {
        return null;
    }

    const progressTask = getLatestProgressTask(quest) ?? getVideoQuestTask(quest);

    if (progressTask) {
        return progressTask;
    }

    for (const taskType of questTaskTypes) {
        const task = getQuestTaskByType(quest, taskType);

        if (task) {
            return task;
        }
    }

    return null;
}

function getAutoCompleteShowcaseQuest(): Quest | null {
    const entries = getActiveAutoCompletes();
    const runningEntries = entries.filter(entry => entry.status === "running");
    const showcaseEntries = runningEntries.length > 0 ? runningEntries : entries;
    let bestQuest: Quest | null = null;
    let bestTimeRemaining = Infinity;
    let currentQuest: Quest | null = null;
    let currentTimeRemaining = Infinity;

    for (const entry of showcaseEntries) {
        const quest = QuestStore.getQuest(entry.questId);

        if (!quest) {
            continue;
        }

        const progress = entry.progress ?? 0;
        const { adjusted: target } = getAutoCompleteQuestTarget(entry.task);
        const timeRemaining = Math.max(0, target - progress);

        if (entry.questId === showcasedAutoCompleteQuestId) {
            currentQuest = quest;
            currentTimeRemaining = timeRemaining;
        }

        if (timeRemaining < bestTimeRemaining) {
            bestQuest = quest;
            bestTimeRemaining = timeRemaining;
        }
    }

    if (!bestQuest) {
        showcasedAutoCompleteQuestId = null;

        return null;
    }

    if (currentQuest && bestQuest.id !== currentQuest.id && bestTimeRemaining >= currentTimeRemaining - showcaseSwitchLeewaySeconds) {
        return currentQuest;
    }

    showcasedAutoCompleteQuestId = bestQuest.id;

    return bestQuest;
}

function getMostRecentlyCompletedUnclaimedQuest(): Quest | null {
    const ignoredQuestIds = getIgnoredQuestIDs();
    const completedQuests = Array.from(QuestStore.quests.values())
        .filter(quest => Boolean(quest.userStatus?.completedAt) && getQuestStatus(quest, ignoredQuestIds) === QuestStatus.Unclaimed);

    return lodash.maxBy(completedQuests, quest => new Date(quest.userStatus?.completedAt ?? 0).getTime()) ?? null;
}

export function getQuestPanelOverride(creative: QuestPanelCreative, questType: number): QuestPanelCreative | null {
    const panelState = useQuestifySettings(["disableQuestsEverything", "disableAccountPanelPromo", "disableAccountPanelQuestProgress"]);

    if (panelState.disableQuestsEverything) {
        return null;
    }

    if (panelState.disableAccountPanelPromo && panelState.disableAccountPanelQuestProgress) {
        return null;
    }

    if (panelState.disableAccountPanelQuestProgress) {
        return creative;
    }

    const nextQuest = getAutoCompleteShowcaseQuest() ?? getMostRecentlyCompletedUnclaimedQuest();

    if (nextQuest) {
        return { ...creative, type: questType, quest: nextQuest };
    }

    return panelState.disableAccountPanelPromo ? null : creative;
}

export function shouldForceQuestPanelVisible(quest: Quest | null): boolean {
    const settings = getQuestifySettings();

    if (!quest || settings.disableQuestsEverything || settings.disableAccountPanelQuestProgress) {
        return false;
    }

    return getQuestAutoCompleteEntry(refreshQuest(quest)) !== null;
}

export function getQuestPanelPercentComplete({
    quest,
    percentCompleteText,
}: QuestPanelPercentCompleteOptions): QuestPanelPercentCompleteResult | null {
    if (!quest) {
        return null;
    }

    const refreshedQuest = refreshQuest(quest);
    const activeAutoComplete = getQuestAutoCompleteEntry(refreshedQuest);
    const task: QuestTask | null = activeAutoComplete?.task ?? getQuestProgressTask(refreshedQuest);

    if (!task) {
        return null;
    }

    const questTarget = activeAutoComplete
        ? getAutoCompleteQuestTarget(task)
            .adjusted
        : task.target;
    const questProgress = activeAutoComplete?.progress ?? getQuestStoredProgress(refreshedQuest, task);

    if (!questTarget || questProgress === null) {
        return null;
    }

    const percentComplete = Math.min(1, questProgress / questTarget);

    if (!percentCompleteText) {
        return { percentComplete };
    }

    return {
        percentComplete,
        percentCompleteText: `${Math.floor(percentComplete * 100)}%`,
    };
}

export function getQuestEmbedProgress(quest: Quest | null): QuestEmbedProgressResult | null {
    const progress = getQuestPanelPercentComplete({ quest, percentCompleteText: " " });

    return progress
        ? { completedRatio: progress.percentComplete, completedRatioDisplay: progress.percentCompleteText }
        : null;
}
