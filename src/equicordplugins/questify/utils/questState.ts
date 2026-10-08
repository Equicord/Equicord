/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Quest } from "@vencord/discord-types";
import { QuestTaskType } from "@vencord/discord-types/enums";
import { QuestStore } from "@webpack/common";

export interface QuestTask {
    type: QuestTaskType;
    target: number;
    applications?: { id: string; }[];
}

export enum QuestStatus {
    Claimed = "CLAIMED",
    Unclaimed = "UNCLAIMED",
    Ignored = "IGNORED",
    Expired = "EXPIRED"
}

export function refreshQuest(quest: Quest): Quest {
    return QuestStore.getQuest(quest.id) ?? quest;
}

export function isVideoQuestTask(taskType: QuestTaskType): boolean {
    return taskType === QuestTaskType.WATCH_VIDEO || taskType === QuestTaskType.WATCH_VIDEO_ON_MOBILE;
}

export function getQuestStoredProgress(quest: Quest, task: QuestTask): number | null {
    if (quest.userStatus?.completedAt) {
        return task.target;
    }

    const progressMap = quest.userStatus?.progress;

    if (!progressMap) {
        return null;
    }

    if (isVideoQuestTask(task.type)) {
        const watchProgress = progressMap.WATCH_VIDEO?.value;
        const mobileProgress = progressMap.WATCH_VIDEO_ON_MOBILE?.value;

        return watchProgress !== undefined || mobileProgress !== undefined
            ? Math.max(watchProgress ?? 0, mobileProgress ?? 0)
            : null;
    }

    return progressMap[task.type]?.value ?? null;
}

export function getQuestStatus(
    quest: Quest,
    ignoredQuestIds: ReadonlyArray<string>,
    checkIgnored: boolean = true,
): QuestStatus {
    const completedQuest = quest.userStatus?.completedAt;
    const claimedQuest = quest.userStatus?.claimedAt;
    const expiredQuest = new Date(quest.config.expiresAt) < new Date();
    const questIgnored = checkIgnored && ignoredQuestIds.includes(quest.id);

    if (claimedQuest) {
        return QuestStatus.Claimed;
    }

    if (checkIgnored && questIgnored && (!expiredQuest || completedQuest)) {
        return QuestStatus.Ignored;
    }

    if (completedQuest || !expiredQuest) {
        return QuestStatus.Unclaimed;
    }

    return QuestStatus.Expired;
}
