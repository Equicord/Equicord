/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Quest, QuestConfig } from "../common/Quest";
import { FluxStore } from "./FluxStore";

export class QuestStore extends FluxStore {
    quests: Map<string, Quest>;
    questConfigs: Map<string, QuestConfig>;
    claimedQuests: Map<string, Quest>;
    excludedQuests: Map<string, Quest>;
    isFetchingClaimedQuests: boolean;
    isFetchingCurrentQuests: boolean;
    isFetchingQuestToDeliver: boolean;
    lastFetchedCurrentQuests: number;
    lastFetchedQuestToDeliver: number;
    questToDeliverForPlacement: Record<string, Quest | null>;
    questAdDecisionByPlacement: Record<string, unknown>;
    questDeliveryOverride: Quest | null;
    questEnrollmentBlockedUntil: number | null;
    getQuest(questId: string): Quest | undefined;
}
