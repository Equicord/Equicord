/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Quest } from "@vencord/discord-types";
import { QuestStore } from "@webpack/common";

import { countIncludedUnclaimedQuests } from "../utils/filtering";
import { getQuestStatus, QuestStatus } from "../utils/questState";
import { getQuestifySettings } from "./access";
import { ignoredQuestIDsKey } from "./def";
import { rerenderQuests } from "./rerender";

function validateQuestBadgeCount(quests: Quest[]): void {
    const settings = getQuestifySettings();
    const { questButtonIncludedTypes } = settings;
    const ignoredQuestIds = getIgnoredQuestIDs();
    const count = countIncludedUnclaimedQuests(quests, ignoredQuestIds, questButtonIncludedTypes);

    settings.questButtonBadgeCount = count;
}

export function getIgnoredQuestIDs(): readonly string[] {
    return getQuestifySettings().ignoredQuestIDs[ignoredQuestIDsKey] ?? [];
}

function setIgnoredQuestIDs(questIDs: string[]): void {
    getQuestifySettings().ignoredQuestIDs[ignoredQuestIDsKey] = questIDs;
}

export function validateIgnoredQuests(qs?: Quest[]): void {
    const currentlyIgnoredQuests = getIgnoredQuestIDs();
    const quests = qs ?? Array.from(QuestStore.quests.values());
    const excludedQuests = Array.from(QuestStore.excludedQuests.values());
    const validQuestIds = new Set([...quests, ...excludedQuests].map(quest => quest.id));
    const validIgnored = Array.from(new Set(currentlyIgnoredQuests.filter(id => validQuestIds.has(id))));

    if (validIgnored.length !== currentlyIgnoredQuests.length) {
        setIgnoredQuestIDs(validIgnored);
    }
    validateQuestBadgeCount(quests);
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

export function ignoreAllQuests(): void {
    const ignoredQuests = new Set(getIgnoredQuestIDs());

    for (const quest of QuestStore.quests.values()) {
        if (getQuestStatus(quest, [], false) === QuestStatus.Unclaimed) {
            ignoredQuests.add(quest.id);
        }
    }

    setIgnoredQuestIDs(Array.from(ignoredQuests));
    validateIgnoredQuests();
}
