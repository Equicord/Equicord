/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { QuestJoinOperator, QuestPlatform, QuestRewardAssignmentMethod, QuestRewardType, QuestSharePolicy, QuestTaskType } from "../../enums";

export interface QuestTask {
    target: number;
    targetUnit?: string;
    streamTarget?: number;
}

export interface QuestProgressHeartbeat {
    lastBeatAt: string;
    expiresAt: string | null;
}

export interface QuestProgress {
    eventName: string;
    value: number;
    updatedAt: string;
    completedAt?: string;
    heartbeat?: QuestProgressHeartbeat;
}

export interface QuestUserStatus {
    userId: string;
    questId: string;
    enrolledAt: string;
    completedAt?: string;
    claimedAt?: string;
    claimedTier: number | null;
    lastStreamHeartbeatAt: string | null;
    streamProgressSeconds: number;
    dismissedQuestContent: number;
    progress?: Partial<Record<QuestTaskType, QuestProgress>>;
}

export interface QuestRewardMessages {
    name: string;
    nameWithArticle: string;
    redemptionInstructionsByPlatform: Record<number, string>;
}

export interface QuestReward {
    type: QuestRewardType;
    skuId: string;
    messages: QuestRewardMessages;
    orbQuantity?: number;
}

export interface QuestRewardsConfig {
    assignmentMethod: QuestRewardAssignmentMethod;
    platforms: QuestPlatform[];
    rewards?: QuestReward[];
    rewardsExpireAt: string;
}

export interface QuestApplication {
    id: string;
    name: string;
}

export interface QuestTaskConfigV2 {
    joinOperator: QuestJoinOperator;
    tasks: Partial<Record<QuestTaskType, QuestTask>>;
}

export interface QuestCtaConfig {
    buttonLabel: string;
    link: string;
    subtitle?: string;
    android?: unknown;
    ios?: unknown;
}

export interface QuestAssets {
    gameTile: string;
    gameTileDark: string;
    gameTileLight: string;
    hero: string;
    heroVideo: string | null;
    logotype: string;
    logotypeDark: string;
    logotypeLight: string;
    questBarHero: string;
    questBarHeroVideo: string | null;
}

export interface QuestColors {
    primary: string;
    secondary: string;
}

export interface QuestMessages {
    questName: string;
    gameTitle: string;
    gamePublisher: string;
}

export interface QuestConfig {
    id: string;
    application: QuestApplication;
    taskConfigV2: QuestTaskConfigV2;
    messages: QuestMessages;
    expiresAt: string;
    startsAt: string;
    configVersion: number;
    rewardsConfig: QuestRewardsConfig;
    sharePolicy: QuestSharePolicy;
    ctaConfig?: QuestCtaConfig;
    assets: QuestAssets;
    colors: QuestColors;
    features: number[];
    cosponsorMetadata?: unknown;
}

export interface Quest {
    id: string;
    config: QuestConfig;
    userStatus?: QuestUserStatus;
    preview: boolean;
    targetedContent: unknown[];
}
