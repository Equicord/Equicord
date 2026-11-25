/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Quest } from "@vencord/discord-types";
import { QuestStore } from "@webpack/common";

import { initialQuestDataFetched } from "../state";
import { pruneIneligibleQueuedAutoCompletes } from "../utils/completion";
import { countIncludedUnclaimedQuests, getQuestStatus, isQuestHidden, QuestStatus } from "../utils/questState";
import { getQuestifySettings } from "./access";
import { ignoredQuestIDsKey } from "./def";
import { rerenderQuests } from "./rerender";

export function validateQuestBadgeCount(): void {
    const settings = getQuestifySettings();
    const quests = Array.from(QuestStore.quests.values());
    const ignoredQuestIds = getIgnoredQuestIDs();
    const count = countIncludedUnclaimedQuests(quests, ignoredQuestIds);

    settings.questButtonBadgeCount = count;
}

export function getIgnoredQuestIDs(): string[] {
    const { ignoredQuestIDs } = getQuestifySettings();
    const ignoredQuestIDsForKey = Array.from(ignoredQuestIDs[ignoredQuestIDsKey] ?? []);
    return ignoredQuestIDsForKey;
}

function setIgnoredQuestIDs(questIDs: string[]): void {
    const { ignoredQuestIDs } = getQuestifySettings();
    const current = ignoredQuestIDs[ignoredQuestIDsKey] ?? [];

    if (current.length === questIDs.length && current.every((id, index) => id === questIDs[index])) {
        return;
    }

    ignoredQuestIDs[ignoredQuestIDsKey] = questIDs;
}

export function validateIgnoredQuests(qs?: Quest[]): void {
    if (qs !== undefined || initialQuestDataFetched) {
        const currentlyIgnoredQuests = getIgnoredQuestIDs();
        const quests = qs ?? Array.from(QuestStore.quests.values());
        const excludedQuests = Array.from(QuestStore.excludedQuests.values());
        const validIgnored = Array.from(new Set<string>(currentlyIgnoredQuests.filter(id => quests.some(quest => quest.id === id) || excludedQuests.some(quest => quest.id === id))));

        setIgnoredQuestIDs(validIgnored);
    }

    pruneIneligibleQueuedAutoCompletes();
    validateQuestBadgeCount();
    rerenderQuests();
}

export function resetIgnoredQuests(): void {
    setIgnoredQuestIDs([]);
    validateIgnoredQuests();
}

export function addIgnoredQuest(questId: string): void {
    setIgnoredQuestIDs(Array.from(new Set([...getIgnoredQuestIDs(), questId])));
    validateIgnoredQuests();
}

export function removeIgnoredQuest(questId: string): void {
    setIgnoredQuestIDs(getIgnoredQuestIDs().filter(id => id !== questId));
    validateIgnoredQuests();
}

export function questIsIgnored(questId: string): boolean {
    return getIgnoredQuestIDs().includes(questId);
}

export function hasIgnorableQuests(): boolean {
    const currentlyIgnored = getIgnoredQuestIDs();
    const currentlyIgnoredSet = new Set(currentlyIgnored);

    for (const quest of QuestStore.quests.values()) {
        if (
            !currentlyIgnoredSet.has(quest.id)
            && !isQuestHidden(quest, currentlyIgnored)
            && getQuestStatus(quest, currentlyIgnored, false) === QuestStatus.Unclaimed
        ) {
            return true;
        }
    }

    return false;
}

export function ignoreAllQuests(): void {
    const currentlyIgnored = getIgnoredQuestIDs();
    const ignoredQuests = new Set<string>(currentlyIgnored);

    for (const quest of QuestStore.quests.values()) {
        if (
            !ignoredQuests.has(quest.id)
            && !isQuestHidden(quest, currentlyIgnored)
            && getQuestStatus(quest, currentlyIgnored, false) === QuestStatus.Unclaimed
        ) {
            ignoredQuests.add(quest.id);
        }
    }

    setIgnoredQuestIDs(Array.from(ignoredQuests));
    validateIgnoredQuests();
}
