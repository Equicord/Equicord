/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Quest, QuestStore as QuestStoreType } from "@vencord/discord-types";
import { QuestFeature, QuestPlatform, QuestRewardType, QuestTaskType } from "@vencord/discord-types/enums";
import { findByPropsLazy, findStoreLazy } from "@webpack";
import { RestAPI } from "@webpack/common";

export { QuestConfigVersion, QuestFeature, QuestJoinOperator, QuestPlatform, QuestRewardAssignmentMethod, QuestRewardType, QuestSharePolicy, QuestStatus, QuestTaskType } from "@vencord/discord-types/enums";
export type { Quest, QuestApplication, QuestAssets, QuestColors, QuestConfig, QuestCtaConfig, QuestMessages, QuestProgress, QuestProgressHeartbeat, QuestReward, QuestRewardMessages, QuestRewardsConfig, QuestStore, QuestTask, QuestTaskConfigV2, QuestUserStatus } from "@vencord/discord-types";

interface QuestRewardModals {
    openQuestsRewardCodeModal(opts: { quest: Quest; sourceQuestContent: number; }): void;
    openQuestOrbsRewardModal(quest: Quest, questContent: number, sourceQuestContent: number): void;
    openQuestCollectibleRewardModal(quest: Quest, questContent: number, sourceQuestContent: number): void;
    openQuestInGameRewardModal(quest: Quest, questContent: number, sourceQuestContent: number): void;
    openVideoQuestModal(quest: Quest): void;
    openQuestMinorEnrollmentBlockModal(): void;
    enrollAndStartVideoQuestWithErrorHandling(quest: Quest): Promise<void>;
    navigateToQuestHome(): void;
    openAppWithQuest(quest: Quest): void;
}

interface HeartbeatManager {
    heartbeats: Record<string, unknown[]>;
    initiateHeartbeat(questId: string, taskType: QuestTaskType, applicationId: string): void;
    terminateHeartbeat(questId: string, taskType: QuestTaskType): void;
    handleSendHeartbeatSuccess(questId: string, taskType: QuestTaskType, data: unknown): void;
    handleSendHeartbeatFailure(questId: string, taskType: QuestTaskType): void;
    calculateHeartbeatDurationMs(questId: string, taskType: QuestTaskType): number;
}

interface RunningGameStore {
    getRunningGames(): RunningGame[];
    getVisibleGame(): RunningGame | null;
    getGameForPID(pid: number): RunningGame | null;
    isObservedAppRunning(appId: string): boolean;
}

interface QuestEndpoints {
    QUESTS_CURRENT_QUESTS: string;
    QUESTS_CLAIMED_QUESTS: string;
    QUEST(questId: string): string;
    QUESTS_ENROLL(questId: string): string;
    QUESTS_HEARTBEAT(questId: string): string;
    QUESTS_VIDEO_PROGRESS(questId: string): string;
    QUESTS_CLAIM_REWARD(questId: string): string;
    QUESTS_REWARD_CODE(questId: string): string;
    QUEST_ON_CONSOLE_START(questId: string): string;
    QUEST_ON_CONSOLE_STOP(questId: string): string;
}

export interface RunningGame {
    id: string;
    name: string;
    pid: number;
    pidPath: number[];
    processName: string;
    exeName: string;
    exePath: string;
    cmdLine: string;
    start: number;
    hidden: boolean;
    isLauncher: boolean;
}

interface ExtendedQuestStore extends QuestStoreType {
    isEnrolling(questId: string): boolean;
    isClaimingReward(questId: string): boolean;
    isProgressingOnDesktop(questId: string): boolean;
    isFetchingRewardCode(questId: string): boolean;
    getOptimisticProgress(questId: string): number | null;
    getRewardCode(questId: string): string | null;
    getStreamHeartbeatFailure(questId: string): boolean;
    selectedTaskPlatform(questId: string): number | null;
}

const QuestStore = findStoreLazy("QuestStore") as ExtendedQuestStore;
const RewardModals = findByPropsLazy("openQuestsRewardCodeModal") as QuestRewardModals;
const HeartbeatMgr = findByPropsLazy("initiateHeartbeat", "terminateHeartbeat") as HeartbeatManager;
const GameStore = findStoreLazy("RunningGameStore") as RunningGameStore;
const Endpoints = findByPropsLazy("QUESTS_HEARTBEAT") as QuestEndpoints;

export const VIDEO_TASKS: readonly QuestTaskType[] = [
    QuestTaskType.WATCH_VIDEO,
    QuestTaskType.WATCH_VIDEO_ON_MOBILE
];

export const PLAY_TASKS: readonly QuestTaskType[] = [
    QuestTaskType.PLAY_ON_DESKTOP,
    QuestTaskType.PLAY_ON_DESKTOP_V2,
    QuestTaskType.PLAY_ON_XBOX,
    QuestTaskType.PLAY_ON_PLAYSTATION,
    QuestTaskType.PLAY_ACTIVITY
];

export const CONSOLE_TASKS: readonly QuestTaskType[] = [
    QuestTaskType.PLAY_ON_XBOX,
    QuestTaskType.PLAY_ON_PLAYSTATION
];

export const ACHIEVEMENT_TASKS: readonly QuestTaskType[] = [
    QuestTaskType.ACHIEVEMENT_IN_GAME,
    QuestTaskType.ACHIEVEMENT_IN_ACTIVITY
];

export const DESKTOP_PLAY_TASKS: readonly QuestTaskType[] = [
    QuestTaskType.PLAY_ON_DESKTOP,
    QuestTaskType.PLAY_ON_DESKTOP_V2
];

export function getQuest(id: string): Quest | undefined {
    return QuestStore.getQuest(id);
}

export function getAllQuests(): Quest[] {
    return [...QuestStore.quests.values()];
}

export function getActiveQuests(): Quest[] {
    return getAllQuests().filter(q => q.userStatus?.enrolledAt && !isExpired(q));
}

export function getInProgressQuests(): Quest[] {
    return getAllQuests().filter(q => q.userStatus?.enrolledAt && !q.userStatus?.completedAt && !isExpired(q));
}

export function getCompletedQuests(): Quest[] {
    return getAllQuests().filter(q => q.userStatus?.completedAt);
}

export function getClaimableQuests(): Quest[] {
    return getAllQuests().filter(q => q.userStatus?.completedAt && !q.userStatus?.claimedAt);
}

export function isExpired(quest: Quest): boolean {
    return new Date(quest.config.expiresAt) < new Date();
}

export function isStarted(quest: Quest): boolean {
    return new Date(quest.config.startsAt) <= new Date();
}

export function isCompleted(quest: Quest): boolean {
    return !!quest.userStatus?.completedAt;
}

export function isClaimed(quest: Quest): boolean {
    return !!quest.userStatus?.claimedAt;
}

export function isEnrolled(quest: Quest): boolean {
    return !!quest.userStatus?.enrolledAt;
}

export function isEnrolling(questId: string): boolean {
    return QuestStore.isEnrolling(questId);
}

export function isClaimingReward(questId: string): boolean {
    return QuestStore.isClaimingReward(questId);
}

export function isProgressingOnDesktop(questId: string): boolean {
    return QuestStore.isProgressingOnDesktop(questId);
}

export function getRewardType(quest: Quest): QuestRewardType | undefined {
    return quest.config.rewardsConfig.rewards?.[0]?.type;
}

export function getRewardName(quest: Quest): string | undefined {
    return quest.config.rewardsConfig.rewards?.[0]?.messages?.name;
}

export function getOrbQuantity(quest: Quest): number | undefined {
    return quest.config.rewardsConfig.rewards?.[0]?.orbQuantity;
}

export function isVideoQuest(quest: Quest): boolean {
    const tasks = quest.config.taskConfigV2.tasks;
    return VIDEO_TASKS.some(t => tasks[t]);
}

export function isPlayQuest(quest: Quest): boolean {
    const tasks = quest.config.taskConfigV2.tasks;
    return PLAY_TASKS.some(t => tasks[t]);
}

export function isDesktopPlayQuest(quest: Quest): boolean {
    const tasks = quest.config.taskConfigV2.tasks;
    return DESKTOP_PLAY_TASKS.some(t => tasks[t]);
}

export function isConsoleQuest(quest: Quest): boolean {
    const tasks = quest.config.taskConfigV2.tasks;
    return CONSOLE_TASKS.some(t => tasks[t]);
}

export function isStreamQuest(quest: Quest): boolean {
    return !!quest.config.taskConfigV2.tasks[QuestTaskType.STREAM_ON_DESKTOP];
}

export function isAchievementQuest(quest: Quest): boolean {
    const tasks = quest.config.taskConfigV2.tasks;
    return ACHIEVEMENT_TASKS.some(t => tasks[t]);
}

export function getQuestTasks(quest: Quest): QuestTaskType[] {
    return Object.keys(quest.config.taskConfigV2.tasks) as QuestTaskType[];
}

export function getQuestTask(quest: Quest): QuestTaskType | undefined {
    const tasks = quest.config.taskConfigV2.tasks;
    for (const type of Object.keys(tasks) as QuestTaskType[]) {
        if (tasks[type]) return type;
    }
    return undefined;
}

export function getQuestProgress(quest: Quest): number {
    const taskType = getQuestTask(quest);
    if (!taskType) return 0;

    if (taskType === QuestTaskType.STREAM_ON_DESKTOP) {
        return quest.userStatus?.streamProgressSeconds ?? 0;
    }
    return quest.userStatus?.progress?.[taskType]?.value ?? 0;
}

export function getQuestTarget(quest: Quest): number {
    const taskType = getQuestTask(quest);
    if (!taskType) return 0;
    return quest.config.taskConfigV2.tasks[taskType]?.target ?? 0;
}

export function getProgressPercent(quest: Quest): number {
    const target = getQuestTarget(quest);
    if (target === 0) return 0;
    return Math.min(100, (getQuestProgress(quest) / target) * 100);
}

export function getApplicationId(quest: Quest): string {
    return quest.config.application.id;
}

export function getApplicationName(quest: Quest): string {
    return quest.config.application.name;
}

export function openClaimModal(quest: Quest, source: QuestFeature = QuestFeature.QUEST_INVENTORY_CARD): void {
    const rewardType = getRewardType(quest);
    if (!rewardType) return;

    switch (rewardType) {
        case QuestRewardType.CODE:
            RewardModals.openQuestsRewardCodeModal({ quest, sourceQuestContent: source });
            break;
        case QuestRewardType.COSMETIC:
            RewardModals.openQuestCollectibleRewardModal(quest, source, source);
            break;
        case QuestRewardType.ORBS:
            RewardModals.openQuestOrbsRewardModal(quest, source, source);
            break;
    }
}

export function openVideoQuestModal(quest: Quest): void {
    RewardModals.openVideoQuestModal(quest);
}

export function navigateToQuestHome(): void {
    RewardModals.navigateToQuestHome();
}

export function enrollAndStartVideoQuest(quest: Quest): Promise<void> {
    return RewardModals.enrollAndStartVideoQuestWithErrorHandling(quest);
}

export function initiateHeartbeat(questId: string, taskType: QuestTaskType, applicationId: string): void {
    HeartbeatMgr.initiateHeartbeat(questId, taskType, applicationId);
}

export function terminateHeartbeat(questId: string, taskType: QuestTaskType): void {
    HeartbeatMgr.terminateHeartbeat(questId, taskType);
}

export function getRunningGames(): RunningGame[] {
    return GameStore.getRunningGames();
}

export function getVisibleGame(): RunningGame | null {
    return GameStore.getVisibleGame();
}

export function isGameRunning(applicationId: string): boolean {
    return GameStore.isObservedAppRunning(applicationId);
}

export function isQuestGameRunning(quest: Quest): boolean {
    return isGameRunning(getApplicationId(quest));
}

export async function sendHeartbeat(questId: string, applicationId: string, streamKey?: string): Promise<unknown> {
    return RestAPI.post({
        url: Endpoints.QUESTS_HEARTBEAT(questId),
        body: {
            stream_key: streamKey,
            application_id: applicationId
        }
    });
}

export async function sendVideoProgress(questId: string, timestamp: number): Promise<void> {
    await RestAPI.post({
        url: Endpoints.QUESTS_VIDEO_PROGRESS(questId),
        body: { timestamp }
    });
}

export async function enrollInQuest(questId: string): Promise<unknown> {
    return RestAPI.post({
        url: Endpoints.QUESTS_ENROLL(questId),
        body: {}
    });
}

export async function claimReward(questId: string, platform: QuestPlatform = QuestPlatform.DESKTOP): Promise<unknown> {
    return RestAPI.post({
        url: Endpoints.QUESTS_CLAIM_REWARD(questId),
        body: { platform }
    });
}

export async function fetchRewardCode(questId: string): Promise<string | null> {
    const cached = QuestStore.getRewardCode(questId);
    if (cached) return cached;

    const { body } = await RestAPI.get({ url: Endpoints.QUESTS_REWARD_CODE(questId) });
    return body?.code ?? null;
}

export async function startConsoleQuest(questId: string): Promise<unknown> {
    return RestAPI.post({
        url: Endpoints.QUEST_ON_CONSOLE_START(questId),
        body: {}
    });
}

export async function stopConsoleQuest(questId: string): Promise<void> {
    await RestAPI.post({
        url: Endpoints.QUEST_ON_CONSOLE_STOP(questId),
        body: {}
    });
}
