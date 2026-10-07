/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { PluginNative } from "@utils/types";
import type { AuthorizedAppToken, Quest, User } from "@vencord/discord-types";
import { QuestTargetedContent, QuestTaskType } from "@vencord/discord-types/enums";
import { findByCodeLazy, findLazy } from "@webpack";
import { FluxDispatcher, QuestStore, RestAPI, showToast, UserStore } from "@webpack/common";

import { getCurrentUserId, getQuestifySettings } from "../settings/access";
import { autoCompleteQuestTaskTypes, isDesktopCompatible } from "../settings/def";
import { getIgnoredQuestIDs } from "../settings/ignoredQuests";
import { rerenderQuests } from "../settings/rerender";
import { parseQuestUserStatus } from "./fetching";
import { getEffectiveQuestTaskType, normalizeQuestName, questMatchesIncludedTypes } from "./filtering";
import { QL } from "./logging";
import { getQuestStatus, getQuestStoredProgress, isVideoQuestTask, QuestStatus, QuestTask, refreshQuest } from "./questState";

type QuestEnrollResult =
    | { type: "success"; }
    | { type: "captcha_failed"; }
    | { type: "unknown_error"; }
    | { type: "previous_in_flight_request"; };

type QuestManualEnrollResult =
    | { type: "success"; }
    | { type: "rate_limited"; retryAfter: number | null; }
    | { type: "cancelled"; }
    | { type: "unknown_error"; error: unknown; };

type QuestEnrollmentResult =
    | { type: "success"; }
    | { type: "rate_limited"; retryAfter: number | null; }
    | { type: "cancelled"; }
    | { type: "unknown_error"; };

interface QuestEnrollmentMetadata {
    questContent: unknown;
    questContentCTA?: unknown;
    sourceQuestContent: unknown;
    sourceQuestContentCTA?: unknown;
    questContentPosition: unknown;
    questContentRowIndex: unknown;
}

interface QuestCTAConstants {
    START_QUEST: string;
    ACCEPT_QUEST: string;
}

interface QuestButtonAnalyticsArgs {
    taskType?: QuestTaskType;
    analyticsCtxQuestContent?: QuestEnrollmentMetadata["questContent"];
    analyticsCtxSourceQuestContent?: QuestEnrollmentMetadata["sourceQuestContent"];
    analyticsCtxQuestContentPosition?: QuestEnrollmentMetadata["questContentPosition"];
    analyticsCtxQuestContentRowIndex?: QuestEnrollmentMetadata["questContentRowIndex"];
}

interface QuestButtonPropsArgs extends Partial<QuestButtonAnalyticsArgs> {
    quest: Quest;
    preClickCallback?: () => void;
}

interface QuestButtonPatchProps {
    icon: string | undefined;
    text: string;
    onClick: () => void;
}

interface QuestButtonTextOptions {
    prepositional?: boolean;
}

enum QuestCompletionState {
    Completing = "COMPLETING",
    Queued = "QUEUED",
    Accepted = "ACCEPTED",
    Unenrolled = "UNENROLLED",
}

type QuestCompletionStateTuple = [text: string | null, state: QuestCompletionState];

interface QuestRewardItem {
    orbQuantity?: number;
    premiumOrbQuantity?: number | null;
    messages?: {
        nameWithArticle?: string;
    };
}

const reportVideoProgress = findByCodeLazy(".QUESTS_VIDEO_PROGRESS(") as (questId: string, progress: number) => Promise<void>;
const sendHeartbeat = findByCodeLazy(".QUESTS_HEARTBEAT(") as (options: {
    questId: string;
    streamKey?: string;
    applicationId?: string;
    terminal?: boolean;
    executableFingerprint?: unknown;
}) => Promise<void>;
const getApplicationProxyTicket = findByCodeLazy("APPLICATION_PROXY_TICKET", "body.ticket") as (applicationId: string, channelId?: string) => Promise<string>;
const enrollInQuestNative = findByCodeLazy('type:"QUESTS_ENROLL_BEGIN",') as (questId: string, options: QuestEnrollmentMetadata) => Promise<QuestEnrollResult>;
const getQuestOrbQuantity = findByCodeLazy("premiumOrbQuantity??", "orbQuantity") as (
    config: Quest["config"],
    user: User | null | undefined
) => number | null;
const QuestCTA = findLazy(m => !!m?.START_QUEST && !!m?.ACCEPT_QUEST) as QuestCTAConstants;

function resolveQuestCTA(taskType?: QuestTaskType): string | undefined {
    return !taskType ? undefined : [QuestTaskType.ACHIEVEMENT_IN_ACTIVITY, QuestTaskType.PLAY_ACTIVITY, QuestTaskType.WATCH_VIDEO].includes(taskType) ? QuestCTA.START_QUEST : QuestCTA.ACCEPT_QUEST;
}

async function getActivityReferrer(appId: string): Promise<string | undefined> {
    try {
        const proxyTicket = await getApplicationProxyTicket(appId);
        const referrer = new URL(`https://${appId}.discordsays.com/`);

        referrer.searchParams.set("instance_id", "example-cl-instance");
        referrer.searchParams.set("platform", "desktop");
        referrer.searchParams.set("discord_proxy_ticket", proxyTicket);

        return referrer.toString();
    } catch (error) {
        QL.error("AUTO_COMPLETE_ACHIEVEMENT_PROXY_TICKET_FAILED", { appId, error });
    }
}

function makeEnrollmentData(args: QuestButtonAnalyticsArgs): QuestEnrollmentMetadata {
    return {
        questContent: args.analyticsCtxQuestContent,
        questContentCTA: resolveQuestCTA(args.taskType),
        sourceQuestContent: args.analyticsCtxSourceQuestContent,
        sourceQuestContentCTA: resolveQuestCTA(args.taskType),
        questContentPosition: args.analyticsCtxQuestContentPosition,
        questContentRowIndex: args.analyticsCtxQuestContentRowIndex
    };
}

const QuestifyNative = VencordNative?.pluginHelpers?.Questify as PluginNative<typeof import("../native")> | undefined;

const videoQuestLeeway = 24;
const resumeExpiryMs = 60 * 60 * 1000;
const maxBatchEnrollmentAttempts = 25;
const maxBatchNonRateLimitEnrollmentFailures = 3;
type AutoCompleteQuestKind = "watch" | "play" | "achievement";
type AutoCompleteQuestStatus = "queued" | "running";
type AutoCompleteStartSource = "manual" | "resume";

interface AutoCompleteEntry {
    questId: string;
    questName: string;
    task: QuestTask;
    kind: AutoCompleteQuestKind;
    status: AutoCompleteQuestStatus;
    progress: number | null;
    abortController: AbortController;
    progressInterval: ReturnType<typeof setInterval> | null;
    rerenderInterval: ReturnType<typeof setInterval> | null;
}

interface AutoCompleteStartOptions {
    source?: AutoCompleteStartSource;
}

interface AutoCompleteStopOptions {
    manual?: boolean;
    preserveResume?: boolean;
    terminalHeartbeat?: boolean;
}

type HeartbeatDispatchResult =
    | { type: "success"; userStatus: Quest["userStatus"]; }
    | { type: "failure"; error: unknown; }
    | { type: "timeout"; };

interface AutoCompleteQuestTarget {
    raw: number;
    adjusted: number;
}

type PlayHeartbeatResult = { progress: number | null; completed: boolean; };
type HeartbeatDispatchWaiter = { promise: Promise<HeartbeatDispatchResult>; cancel: () => void; };

interface VideoProgressReportOptions {
    attempts?: number;
    delay?: number;
    displayProgress?: number;
}

const activeAutoCompletes = new Map<string, AutoCompleteEntry>();
let enrollmentRateLimitBlockedUntil = 0;
let queueAllAutoCompleteQuestsAbortController: AbortController | null = null;
let suppressQueueDrain = false;
let videoProgressStackTracePatchSucceeded = false;
let heartbeatStackTracePatchSucceeded = false;
let didShowBrokenAutoCompleteToast = false;

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) {
        return Promise.reject(new Error("Auto-complete aborted."));
    }

    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            signal?.removeEventListener("abort", onAbort);
            resolve();
        }, ms);

        function onAbort() {
            clearTimeout(timeoutId);
            signal?.removeEventListener("abort", onAbort);
            reject(new Error("Auto-complete aborted."));
        }

        signal?.addEventListener("abort", onAbort, { once: true });
    });
}

function clampFloat(value: number, precision: number = 6): number {
    return Number(value.toFixed(precision));
}

function randomBetween(min: number, max: number): number {
    return clampFloat(min + Math.random() * (max - min));
}

export function setVideoProgressStackTracePatchSucceeded(): void {
    videoProgressStackTracePatchSucceeded = true;
}

export function setHeartbeatStackTracePatchSucceeded(): void {
    heartbeatStackTracePatchSucceeded = true;
}

function showBrokenAutoCompleteToast(): void {
    if (didShowBrokenAutoCompleteToast) {
        return;
    }

    didShowBrokenAutoCompleteToast = true;
    showToast("AutoComplete is broken. A fix will be implemented shortly.", "failure");
}

export function hasEnabledAutoCompleteQuestTypes(): boolean {
    return autoCompleteQuestTaskTypes.some(questType => isDesktopCompatible(questType) && getQuestifySettings().autoCompleteQuestTypes[questType]);
}

function isAutoCompleteRuntimeReady(notify: boolean = false): boolean {
    const settings = getQuestifySettings();
    if (!settings.enabled || settings.disableQuestsEverything) return false;

    const stackTracePatches = {
        videoProgress: videoProgressStackTracePatchSucceeded,
        heartbeat: heartbeatStackTracePatchSucceeded,
    };

    if (stackTracePatches.videoProgress && stackTracePatches.heartbeat) {
        return true;
    }

    if (notify) {
        showBrokenAutoCompleteToast();
        QL.warn("AUTO_COMPLETE_STACK_TRACE_PATCH_MISSING", stackTracePatches);
    }

    return false;
}

export function getQuestAutoCompleteProgress(quest: Quest): number | null {
    return activeAutoCompletes.get(quest.id)?.progress ?? null;
}

export function getQuestAutoCompleteEntry(questOrId: Quest | string): Readonly<AutoCompleteEntry> | null {
    const questId = typeof questOrId === "string" ? questOrId : questOrId.id;

    return activeAutoCompletes.get(questId) ?? null;
}

export function getAutoCompleteQuestTarget(task: QuestTask): AutoCompleteQuestTarget {
    const raw = task.target;

    return {
        raw,
        adjusted: Math.max(0, raw - (isVideoQuestTask(task.type) && getQuestifySettings().completeVideoQuestsQuicker ? videoQuestLeeway : 0)),
    };
}

function getAutoCompleteQuestTasks(quest: Quest): QuestTask[] {
    const tasks = quest.config.taskConfigV2?.tasks;

    if (!tasks) {
        return [];
    }

    return autoCompleteQuestTaskTypes.flatMap(taskType => {
        const task = tasks[taskType] as QuestTask | undefined;

        return task ? [task] : [];
    });
}

function getQuestAutoCompleteKind(task: QuestTask): AutoCompleteQuestKind | null {
    switch (task.type) {
        case QuestTaskType.WATCH_VIDEO:
        case QuestTaskType.WATCH_VIDEO_ON_MOBILE:
            return "watch";
        case QuestTaskType.PLAY_ON_DESKTOP:
        case QuestTaskType.PLAY_ON_XBOX:
        case QuestTaskType.PLAY_ON_PLAYSTATION:
        case QuestTaskType.PLAY_ACTIVITY:
            return "play";
        case QuestTaskType.ACHIEVEMENT_IN_ACTIVITY:
            return "achievement";
        default:
            return null;
    }
}

function isAutoCompleteQuestTaskEnabled(task: QuestTask): boolean {
    const taskType = getEffectiveQuestTaskType(task);
    const compatible = isDesktopCompatible(taskType);
    const enabled = getQuestifySettings().autoCompleteQuestTypes[taskType] === true;

    return compatible && enabled && getQuestAutoCompleteKind(task) != null;
}

function resolveAutoCompleteQuest(quest: Quest): { task: QuestTask; kind: AutoCompleteQuestKind; } | null {
    for (const task of getAutoCompleteQuestTasks(quest)) {
        const kind = getQuestAutoCompleteKind(task);

        if (kind && isAutoCompleteQuestTaskEnabled(task)) {
            return { task, kind };
        }
    }

    return null;
}

function getResumeQuestIds(): string[] {
    return Array.from(activeAutoCompletes.keys());
}

function isResumeStateExpired(timestamp: number): boolean {
    return Date.now() - timestamp > resumeExpiryMs;
}

function updateResumeState(questIDs: string[] = getResumeQuestIds()): void {
    const userId = getCurrentUserId();

    if (!userId) {
        QL.warn("AUTO_COMPLETE_RESUME_NO_USER");
        return;
    }

    if (!getQuestifySettings().resumeInterruptedQuests || questIDs.length === 0) {
        delete getQuestifySettings().resumeQuestIDs[userId];
        return;
    }

    getQuestifySettings().resumeQuestIDs[userId] = {
        timestamp: Date.now(),
        questIDs,
    };
}

function createAutoCompleteEntry(
    quest: Quest,
    task: QuestTask,
    kind: AutoCompleteQuestKind,
): AutoCompleteEntry {
    return {
        questId: quest.id,
        questName: normalizeQuestName(quest),
        task,
        kind,
        status: "queued",
        progress: getQuestStoredProgress(quest, task),
        abortController: new AbortController(),
        progressInterval: null,
        rerenderInterval: null,
    };
}

function clearEntryTimers(entry: AutoCompleteEntry): void {
    if (entry.progressInterval) {
        clearInterval(entry.progressInterval);
        entry.progressInterval = null;
    }

    if (entry.rerenderInterval) {
        clearInterval(entry.rerenderInterval);
        entry.rerenderInterval = null;
    }
}

function isEntryActive(entry: AutoCompleteEntry): boolean {
    return activeAutoCompletes.get(entry.questId) === entry && !entry.abortController.signal.aborted;
}

function formatQuestTime(seconds: number, prepositional: boolean = false): string {
    const remaining = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(remaining / 60);
    const secondsPart = remaining % 60;

    if (prepositional) {
        return remaining >= 60 ? `${minutes}m ${secondsPart}s` : `${secondsPart}s`;
    }

    return `${String(minutes).padStart(2, "0")}:${String(secondsPart).padStart(2, "0")}`;
}

function isQuestQueuedForResume(questId: string): boolean {
    if (!getQuestifySettings().resumeInterruptedQuests) {
        return false;
    }

    const userId = getCurrentUserId();
    const resumeState = userId ? getQuestifySettings().resumeQuestIDs[userId] : null;

    return Boolean(resumeState && !isResumeStateExpired(resumeState.timestamp) && resumeState.questIDs.includes(questId));
}

function getQueuedAutoCompletePosition(questId: string): number | null {
    const queuedQuestIds = Array.from(activeAutoCompletes.values())
        .filter(entry => entry.status === "queued")
        .map(entry => entry.questId);
    const queuedIndex = queuedQuestIds.indexOf(questId);

    return queuedIndex === -1 ? null : queuedIndex + 1;
}

function getQuestCompletionState(quest: Quest, options: QuestButtonTextOptions = {}): QuestCompletionStateTuple {
    quest = refreshQuest(quest);

    const activeEntry = activeAutoCompletes.get(quest.id);
    const resolvedQuest = activeEntry ?? resolveAutoCompleteQuest(quest);

    if (!resolvedQuest) {
        return [null, QuestCompletionState.Unenrolled];
    }

    const { task, kind } = resolvedQuest;
    const target = getAutoCompleteQuestTarget(task).adjusted;
    const enrolledAt = quest.userStatus?.enrolledAt ? new Date(quest.userStatus.enrolledAt) : null;
    const storedProgress = activeEntry?.progress ?? getQuestStoredProgress(quest, task) ?? 0;
    const elapsedProgress = !activeEntry && enrolledAt && isVideoQuestTask(task.type) && getQuestifySettings().completeVideoQuestsQuicker
        ? Math.max(0, (Date.now() - enrolledAt.getTime()) / 1000)
        : 0;
    const progress = Math.min(target, Math.max(storedProgress, elapsedProgress));
    const timeRemaining = Math.max(0, target - progress);
    const formattedTime = formatQuestTime(timeRemaining, options.prepositional);
    const immediate = kind === "achievement" || timeRemaining <= 1;

    if (activeEntry?.status === "running") {
        const text = immediate
            ? "Completing..."
            : `Completing ${options.prepositional ? `in ${formattedTime}` : `(${formattedTime})`}`;

        return [text, QuestCompletionState.Completing];
    }

    if (activeEntry?.status === "queued") {
        return [`Queued (${getQueuedAutoCompletePosition(quest.id) ?? "?"})`, QuestCompletionState.Queued];
    }

    if (enrolledAt) {
        if (isQuestQueuedForResume(quest.id)) {
            return ["Resuming...", QuestCompletionState.Queued];
        }

        const meaningfulProgress = progress >= 1;

        return [
            immediate ? "Complete Now" : `${meaningfulProgress ? "Resume" : "Complete"} (${formatQuestTime(timeRemaining)})`,
            QuestCompletionState.Accepted,
        ];
    }

    return [
        immediate ? "Complete Now" : `Complete (${formatQuestTime(target)})`,
        QuestCompletionState.Unenrolled,
    ];
}

export function getQuestButtonProps(args: QuestButtonPropsArgs): QuestButtonPatchProps | null {
    if (!canAutoCompleteQuest(args.quest)) {
        return null;
    }

    const [label, completionState] = getQuestCompletionState(args.quest);

    if (!label) {
        return null;
    }

    return {
        icon: undefined,
        text: label,
        onClick: async () => {
            if (completionState === QuestCompletionState.Completing || completionState === QuestCompletionState.Queued) {
                stopQuestAutoComplete(args.quest, { manual: true, preserveResume: false, terminalHeartbeat: true });
            } else {
                if (completionState === QuestCompletionState.Unenrolled) {
                    args.preClickCallback?.();
                    const userId = getCurrentUserId();
                    if ((await ensureQuestEnrolledForAutoComplete(args.quest, { analytics: args, method: "native" })).type !== "success" || getCurrentUserId() !== userId) return;
                }
                processQuestForAutoComplete(args.quest, { source: "manual" });
            }
            rerenderQuests();
        }
    };
}

export function getQuestPanelSubtitleText(quest: Quest): string | null {
    quest = refreshQuest(quest);

    const questCompleted = Boolean(quest.userStatus?.completedAt)
        && getQuestStatus(quest, getIgnoredQuestIDs()) === QuestStatus.Unclaimed;
    const [completingText] = getQuestCompletionState(quest, { prepositional: true });
    const completedText = questCompleted ? "Completed" : null;
    const statusText = completedText ?? completingText;

    if (!statusText) {
        return null;
    }

    const rewardItem = (quest.config.rewardsConfig.rewards[0] ?? null) as QuestRewardItem | null;
    const orbsReward = getQuestOrbQuantity(quest.config, UserStore.getCurrentUser()) ?? 0;

    if (orbsReward > 0) {
        return `${statusText} for ${orbsReward} Orbs.`;
    }

    if (rewardItem?.messages?.nameWithArticle) {
        return `${statusText} for ${rewardItem.messages.nameWithArticle}.`;
    }

    return `${statusText} for an unrecognized reward.`;
}

export function canAutoCompleteQuest(quest: Quest): boolean {
    if (!isAutoCompleteRuntimeReady()) {
        return false;
    }

    if (quest.userStatus?.completedAt) {
        return false;
    }

    if (getQuestStatus(quest, getIgnoredQuestIDs()) !== QuestStatus.Unclaimed) {
        return false;
    }

    return resolveAutoCompleteQuest(quest) != null;
}

function getEnrollmentRetryAfter(error: unknown): number | null {
    const response = error as { body?: { retry_after?: unknown; retryAfter?: unknown; }; retry_after?: unknown; retryAfter?: unknown; };
    const retryAfter = response.body?.retry_after ?? response.body?.retryAfter ?? response.retry_after ?? response.retryAfter;

    return typeof retryAfter === "number" && Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter
        : null;
}

function isEnrollmentRateLimitError(error: unknown): boolean {
    const response = error as { status?: unknown; };

    return response.status === 429 || getEnrollmentRetryAfter(error) !== null;
}

function getEnrollmentRateLimitRemainingSeconds(): number | null {
    if (enrollmentRateLimitBlockedUntil <= Date.now()) {
        enrollmentRateLimitBlockedUntil = 0;
        return null;
    }

    return (enrollmentRateLimitBlockedUntil - Date.now()) / 1000;
}

export function isQuestEnrollmentRateLimited(): boolean {
    return getEnrollmentRateLimitRemainingSeconds() !== null;
}

function blockQuestEnrollmentForRetryAfter(retryAfter: number | null): void {
    if (retryAfter === null) {
        return;
    }

    enrollmentRateLimitBlockedUntil = Math.max(enrollmentRateLimitBlockedUntil, Date.now() + retryAfter * 1000);
}

function showQuestEnrollmentFailureToast(quest: Quest, result: Exclude<QuestEnrollmentResult, { type: "success"; }>): void {
    const rateLimitSuffix = result.type === "rate_limited" ? " due to rate limits" : "";

    showToast(`Enrollment in ${normalizeQuestName(quest)} Quest failed${rateLimitSuffix}.`, "failure");
}

async function enrollInQuestManually(quest: Quest): Promise<QuestManualEnrollResult> {
    quest = refreshQuest(quest);
    const userId = getCurrentUserId();

    if (quest.userStatus?.enrolledAt) {
        return { type: "success" };
    }

    const blockedFor = getEnrollmentRateLimitRemainingSeconds();

    if (blockedFor !== null) {
        return { type: "rate_limited", retryAfter: blockedFor };
    }

    FluxDispatcher.dispatch({
        type: "QUESTS_ENROLL_BEGIN",
        questId: quest.id,
    });

    try {
        const response = await RestAPI.post({
            url: `/quests/${quest.id}/enroll`,
            body: { location: QuestTargetedContent.QUEST_HOME_DESKTOP },
        });

        if (getCurrentUserId() !== userId) {
            return { type: "cancelled" };
        }

        FluxDispatcher.dispatch({
            type: "QUESTS_ENROLL_SUCCESS",
            enrolledQuestUserStatus: parseQuestUserStatus(response.body),
        });

        return { type: "success" };
    } catch (error) {
        if (getCurrentUserId() !== userId) {
            return { type: "cancelled" };
        }

        FluxDispatcher.dispatch({
            type: "QUESTS_ENROLL_FAILURE",
            questId: quest.id,
        });

        if (isEnrollmentRateLimitError(error)) {
            const retryAfter = getEnrollmentRetryAfter(error);

            blockQuestEnrollmentForRetryAfter(retryAfter);

            return { type: "rate_limited", retryAfter };
        }

        return { type: "unknown_error", error };
    }
}

async function ensureQuestEnrolledForAutoComplete(
    quest: Quest,
    options: { analytics?: QuestButtonAnalyticsArgs; method?: "manual" | "native"; } = {},
): Promise<QuestEnrollmentResult> {
    quest = refreshQuest(quest);

    if (quest.userStatus?.enrolledAt) {
        return { type: "success" };
    }

    const result = options.method === "manual"
        ? await enrollInQuestManually(quest)
        : await enrollInQuestNative(quest.id, makeEnrollmentData(options.analytics ?? {}));

    if (result.type === "cancelled") {
        return { type: "cancelled" };
    }

    if (result.type === "success" || result.type === "previous_in_flight_request") {
        return { type: "success" };
    }

    const failure = result.type === "rate_limited"
        ? { type: "rate_limited", retryAfter: result.retryAfter } as const
        : { type: "unknown_error" } as const;

    showQuestEnrollmentFailureToast(quest, failure);

    return failure;
}

function getQuestExpiryTime(quest: Quest): number {
    const time = new Date(quest.config.expiresAt).getTime();

    return Number.isFinite(time) ? time : Infinity;
}

export function getQueueableAutoCompleteQuests(): Quest[] {
    const settings = getQuestifySettings();
    const includedTypes = settings.questButtonIncludedTypes;

    return Array.from(QuestStore.quests.values())
        .filter(quest => !activeAutoCompletes.has(quest.id) && questMatchesIncludedTypes(quest, includedTypes) && canAutoCompleteQuest(quest))
        .sort((a, b) => getQuestExpiryTime(a) - getQuestExpiryTime(b));
}

function setQuestAutoCompleteProgress(questOrId: Quest | string, progress: number | null): boolean {
    const questId = typeof questOrId === "string" ? questOrId : questOrId.id;
    const entry = activeAutoCompletes.get(questId);

    if (!entry) {
        return false;
    }

    entry.progress = progress == null ? null : Math.max(0, progress);

    return true;
}

async function waitUntilEnrolled(quest: Quest, entry: AutoCompleteEntry): Promise<Quest | null> {
    const timeout = 60000;
    const startedAt = Date.now();

    quest = refreshQuest(quest);

    if (quest.userStatus?.enrolledAt) {
        return quest;
    }

    if (quest.userStatus?.completedAt) {
        return null;
    }

    while (isEntryActive(entry) && !quest.userStatus?.enrolledAt && (Date.now() - startedAt) < timeout) {
        await sleep(500, entry.abortController.signal);
        quest = refreshQuest(quest);
    }

    if (quest.userStatus?.enrolledAt) {
        return quest;
    }

    QL.warn("AUTO_COMPLETE_ENROLL_TIMEOUT", { questId: quest.id, questName: entry.questName, timeout });
    return null;
}

async function reportVideoQuestProgress(quest: Quest, entry: AutoCompleteEntry, progress: number, options: VideoProgressReportOptions = {}): Promise<boolean> {
    quest = refreshQuest(quest);

    const attempts = options.attempts ?? 1;
    const delay = options.delay ?? 2500;
    const displayProgress = options.displayProgress ?? progress;

    if (!quest.userStatus?.enrolledAt) {
        QL.warn("AUTO_COMPLETE_VIDEO_UNENROLLED", { questId: quest.id, questName: entry.questName });
        return false;
    }

    if (quest.userStatus?.completedAt) {
        return true;
    }

    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            await reportVideoProgress(quest.id, progress);
            if (isEntryActive(entry)) setQuestAutoCompleteProgress(quest, displayProgress);

            QL.info("AUTO_COMPLETE_VIDEO_PROGRESS_REPORTED", { questId: quest.id, questName: entry.questName, progress, displayProgress, attempt, attempts });
            return true;
        } catch (error) {
            QL.error("AUTO_COMPLETE_VIDEO_PROGRESS_FAILED", { questId: quest.id, questName: entry.questName, progress, attempt, attempts, error });

            if (attempt < attempts) {
                await sleep(delay, entry.abortController.signal);
            }
        }
    }

    return false;
}

function waitForHeartbeatDispatchResult(questId: string, timeoutMs: number): HeartbeatDispatchWaiter {
    let settled = false;
    let cleanup = () => { };
    const promise = new Promise<HeartbeatDispatchResult>(resolve => {
        const successEvent = "QUESTS_SEND_HEARTBEAT_SUCCESS";
        const failureEvent = "QUESTS_SEND_HEARTBEAT_FAILURE";
        const timeoutId = setTimeout(() => {
            cleanup();
            resolve({ type: "timeout" });
        }, timeoutMs);

        cleanup = () => {
            if (settled) {
                return;
            }

            settled = true;
            clearTimeout(timeoutId);
            FluxDispatcher.unsubscribe(successEvent, onSuccess);
            FluxDispatcher.unsubscribe(failureEvent, onFailure);
        };

        function onSuccess(data: { questId?: string; userStatus?: Quest["userStatus"]; }) {
            if (data.questId !== questId) {
                return;
            }

            cleanup();
            resolve({ type: "success", userStatus: data.userStatus ?? null });
        }

        function onFailure(data: { questId?: string; error?: unknown; }) {
            if (data.questId !== questId) {
                return;
            }

            cleanup();
            resolve({ type: "failure", error: data.error });
        }

        FluxDispatcher.subscribe(successEvent, onSuccess);
        FluxDispatcher.subscribe(failureEvent, onFailure);
    });

    return { promise, cancel: cleanup };
}

function getPlayProgressValue(userStatus: Quest["userStatus"], task: QuestTask): number | null {
    return userStatus?.progress?.[task.type]?.value ?? null;
}

async function reportPlayQuestProgress(
    quest: Quest,
    entry: AutoCompleteEntry,
    terminal: boolean,
    options: { attempts?: number; } = {},
): Promise<PlayHeartbeatResult> {
    quest = refreshQuest(quest);

    if (!quest.userStatus?.enrolledAt) {
        QL.warn("AUTO_COMPLETE_PLAY_UNENROLLED", { questId: quest.id, questName: entry.questName });
        return { progress: null, completed: false };
    }

    if (quest.userStatus?.completedAt && !terminal) {
        return { progress: getQuestStoredProgress(quest, entry.task), completed: true };
    }

    const attempts = options.attempts ?? 1;
    const delay = 2500;
    const timeout = 10000;
    const applicationId = entry.task.applications?.[0]?.id;

    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            const dispatchWaiter = waitForHeartbeatDispatchResult(quest.id, timeout);

            try {
                await sendHeartbeat({
                    questId: quest.id,
                    applicationId,
                    terminal,
                });
            } catch (error) {
                dispatchWaiter.cancel();
                throw error;
            }

            const dispatchResult = await dispatchWaiter.promise;

            if (dispatchResult.type === "failure") {
                QL.error("AUTO_COMPLETE_PLAY_HEARTBEAT_FAILURE", { questId: quest.id, questName: entry.questName, attempt, attempts, error: dispatchResult.error });
            } else if (dispatchResult.type === "timeout") {
                QL.warn("AUTO_COMPLETE_PLAY_HEARTBEAT_TIMEOUT", { questId: quest.id, questName: entry.questName, attempt, attempts, timeout });
            } else {
                const updatedQuest = refreshQuest(quest);
                const progress = getPlayProgressValue(dispatchResult.userStatus, entry.task)
                    ?? getQuestStoredProgress(updatedQuest, entry.task)
                    ?? 0;
                const completed = !!dispatchResult.userStatus?.completedAt || !!updatedQuest.userStatus?.completedAt;

                if (isEntryActive(entry)) setQuestAutoCompleteProgress(quest, terminal ? progress : Math.max(progress, entry.progress ?? 0));
                QL.info("AUTO_COMPLETE_PLAY_HEARTBEAT_SENT", { questId: quest.id, questName: entry.questName, progress, target: entry.task.target, terminal });

                return { progress, completed };
            }
        } catch (error) {
            QL.error("AUTO_COMPLETE_PLAY_HEARTBEAT_ERROR", { questId: quest.id, questName: entry.questName, attempt, attempts, error });
        }

        if (attempt < attempts) {
            await sleep(delay, entry.abortController.signal);
        }
    }

    return { progress: null, completed: false };
}

function startRerenderInterval(entry: AutoCompleteEntry): void {
    clearEntryTimers(entry);

    entry.rerenderInterval = setInterval(() => {
        if (!isEntryActive(entry)) {
            clearEntryTimers(entry);
            return;
        }

        rerenderQuests();
    }, 1000);
}

async function runVideoQuest(quest: Quest, entry: AutoCompleteEntry, target: AutoCompleteQuestTarget): Promise<boolean> {
    quest = await waitUntilEnrolled(quest, entry) ?? quest;

    if (!isEntryActive(entry) || !quest.userStatus?.enrolledAt) {
        return false;
    }

    const reportTarget = target.raw;
    const completionTarget = target.adjusted;
    const enrolledAt = new Date(quest.userStatus.enrolledAt);
    const initialStoredProgress = getQuestStoredProgress(quest, entry.task) ?? 0;
    const initialProgress = getQuestifySettings().completeVideoQuestsQuicker
        ? clampFloat(Math.max(1, (Date.now() - enrolledAt.getTime()) / 1000))
        : Math.max(0, initialStoredProgress);
    let displayedProgress = clampFloat(Math.min(completionTarget, initialProgress));
    let reportedProgress = clampFloat(Math.min(reportTarget, initialProgress));
    let maximumPlaybackTimestamp = Math.floor(reportedProgress);
    let nextReportThreshold = 0;
    let lastTickAt = performance.now();

    setQuestAutoCompleteProgress(quest, displayedProgress);
    startRerenderInterval(entry);

    const timeRemaining = Math.max(0, completionTarget - displayedProgress);
    const progressToCover = Math.max(0, reportTarget - reportedProgress);
    const speedFactor = timeRemaining > 0 ? progressToCover / timeRemaining : 0;

    QL.info("AUTO_COMPLETE_VIDEO_STARTED", { questId: quest.id, questName: entry.questName, timeRemaining, target });

    if (timeRemaining <= 0) {
        return reportVideoQuestProgress(quest, entry, reportTarget, { attempts: 3, displayProgress: completionTarget });
    }

    if (reportedProgress > 0) {
        const initialReport = clampFloat(Math.min(reportTarget, reportedProgress));
        const reported = await reportVideoQuestProgress(quest, entry, initialReport, { attempts: 3, displayProgress: displayedProgress });

        if (!reported || !isEntryActive(entry)) {
            return false;
        }

        nextReportThreshold = clampFloat(initialReport + randomBetween(6, 8));
    }

    while (isEntryActive(entry) && displayedProgress < completionTarget) {
        await sleep(250, entry.abortController.signal);

        const now = performance.now();
        const elapsedSeconds = clampFloat((now - lastTickAt) / 1000);
        lastTickAt = now;

        displayedProgress = clampFloat(Math.min(completionTarget, displayedProgress + elapsedSeconds));
        reportedProgress = clampFloat(Math.min(reportTarget, reportedProgress + elapsedSeconds * speedFactor));
        maximumPlaybackTimestamp = Math.max(maximumPlaybackTimestamp, Math.floor(reportedProgress));
        setQuestAutoCompleteProgress(quest, displayedProgress);

        if (reportedProgress >= nextReportThreshold && displayedProgress < completionTarget) {
            const progressToReport = clampFloat(Math.min(reportTarget, nextReportThreshold + randomBetween(0, Math.max(0, reportedProgress - nextReportThreshold))));
            const reported = await reportVideoQuestProgress(quest, entry, progressToReport, { displayProgress: displayedProgress });

            if (!reported) {
                return false;
            }

            nextReportThreshold = clampFloat(progressToReport + randomBetween(6, 8));
        }
    }

    return isEntryActive(entry) && reportVideoQuestProgress(quest, entry, Math.min(reportTarget, maximumPlaybackTimestamp), { attempts: 3, displayProgress: completionTarget });
}

async function runPlayQuest(quest: Quest, entry: AutoCompleteEntry, target: AutoCompleteQuestTarget): Promise<boolean> {
    quest = await waitUntilEnrolled(quest, entry) ?? quest;

    if (!isEntryActive(entry) || !quest.userStatus?.enrolledAt) {
        return false;
    }

    const questTarget = target.adjusted;
    const initialProgress = getQuestStoredProgress(quest, entry.task) ?? 0;
    const maximumHeartbeatDurationMs = 60 * 1000;
    const heartbeatBufferMs = 1000;

    setQuestAutoCompleteProgress(quest, initialProgress);
    startRerenderInterval(entry);

    entry.progressInterval = setInterval(() => {
        if (!isEntryActive(entry) || entry.progress == null) {
            return;
        }

        setQuestAutoCompleteProgress(entry.questId, Math.min(questTarget, entry.progress + 1));
    }, 1000);

    QL.info("AUTO_COMPLETE_PLAY_STARTED", { questId: quest.id, questName: entry.questName, remaining: Math.max(0, questTarget - initialProgress), target });

    let heartbeat = await reportPlayQuestProgress(quest, entry, false, { attempts: 3 });

    if (heartbeat.progress === null) {
        return false;
    }

    while (isEntryActive(entry)) {
        if (heartbeat.completed || heartbeat.progress >= questTarget) {
            await reportPlayQuestProgress(refreshQuest(quest), entry, true, { attempts: 3 });
            return true;
        }

        const remainingMs = Math.max(0, (questTarget - heartbeat.progress) * 1000);
        await sleep(remainingMs <= maximumHeartbeatDurationMs ? remainingMs + heartbeatBufferMs : maximumHeartbeatDurationMs, entry.abortController.signal);
        heartbeat = await reportPlayQuestProgress(quest, entry, false, { attempts: 3 });

        if (heartbeat.progress === null) {
            return false;
        }
    }

    return false;
}

async function runAchievementQuest(quest: Quest, entry: AutoCompleteEntry, target: AutoCompleteQuestTarget): Promise<boolean> {
    quest = await waitUntilEnrolled(quest, entry) ?? quest;

    const userId = getCurrentUserId();
    if (!isEntryActive(entry) || !quest.userStatus?.enrolledAt || !userId) {
        return false;
    }

    if (!QuestifyNative?.complete) {
        QL.error("AUTO_COMPLETE_ACHIEVEMENT_NATIVE_MISSING", { questId: quest.id, questName: entry.questName });
        return false;
    }

    const appId = entry.task.applications?.[0]?.id;

    if (!appId) {
        QL.warn("AUTO_COMPLETE_ACHIEVEMENT_APP_MISSING", { questId: quest.id, questName: entry.questName });
        return false;
    }

    setQuestAutoCompleteProgress(quest, 0);

    let authCode: string | null = null;

    try {
        const response = await RestAPI.post({
            url: `/oauth2/authorize?client_id=${appId}&response_type=code&scope=identify%20applications.entitlements&state=`,
            body: { authorize: true },
        });
        const location = response?.body?.location;

        authCode = location ? new URL(location).searchParams.get("code") : null;
    } catch (error) {
        QL.error("AUTO_COMPLETE_ACHIEVEMENT_AUTH_FAILED", { questId: quest.id, questName: entry.questName, error });
        return false;
    }

    if (!authCode) {
        QL.warn("AUTO_COMPLETE_ACHIEVEMENT_AUTH_CODE_MISSING", { questId: quest.id, questName: entry.questName });
        return false;
    }

    try {
        const activityReferrer = isEntryActive(entry) ? await getActivityReferrer(appId) : undefined;
        const result = isEntryActive(entry) && getCurrentUserId() === userId
            ? await QuestifyNative.complete(appId, authCode, target.adjusted, quest.id, activityReferrer)
            : null;
        if (getCurrentUserId() !== userId) return false;
        const success = result?.success === true;

        if (isEntryActive(entry)) setQuestAutoCompleteProgress(quest, success ? target.adjusted : 0);

        if (result && !success) {
            QL.error("AUTO_COMPLETE_ACHIEVEMENT_FAILED", { questId: quest.id, questName: entry.questName, error: result.error });
        }

        return success;
    } finally {
        try {
            const response = getCurrentUserId() === userId ? await RestAPI.get({ url: "/oauth2/tokens" }) : null;

            if (getCurrentUserId() === userId) {
                const deauthToken = response?.body.findLast((token: AuthorizedAppToken) => token.application.id === appId)?.id;

                if (deauthToken) {
                    await RestAPI.del({ url: `/oauth2/tokens/${deauthToken}` });
                    QL.info("AUTO_COMPLETE_ACHIEVEMENT_DEAUTH_SUCCESS", { questId: quest.id, questName: entry.questName, appId });
                } else {
                    QL.error("AUTO_COMPLETE_ACHIEVEMENT_DEAUTH_FAILED", { questId: quest.id, questName: entry.questName, error: "DEAUTH Token Not Found." });
                }
            }
        } catch (error) {
            QL.error("AUTO_COMPLETE_ACHIEVEMENT_DEAUTH_FAILED", { questId: quest.id, questName: entry.questName, error });
        }
    }
}

async function runAutoCompleteQuest(quest: Quest, entry: AutoCompleteEntry): Promise<boolean> {
    const target = getAutoCompleteQuestTarget(entry.task);

    QL.info("AUTO_COMPLETE_RUN_START", {
        questId: quest.id,
        questName: entry.questName,
        kind: entry.kind,
        taskType: entry.task.type,
        target,
    });

    switch (entry.kind) {
        case "watch":
            return runVideoQuest(quest, entry, target);
        case "play":
            return runPlayQuest(quest, entry, target);
        case "achievement":
            return runAchievementQuest(quest, entry, target);
    }
}

async function runEntry(quest: Quest, entry: AutoCompleteEntry): Promise<void> {
    entry.status = "running";
    updateResumeState();

    try {
        const completed = await runAutoCompleteQuest(quest, entry);

        if (!isEntryActive(entry)) {
            return;
        }

        if (completed) {
            QL.info("AUTO_COMPLETE_COMPLETED", { questId: entry.questId, questName: entry.questName });
        } else {
            QL.warn("AUTO_COMPLETE_FAILED", { questId: entry.questId, questName: entry.questName });
        }
    } catch (error) {
        if (entry.abortController.signal.aborted) {
            QL.warn("AUTO_COMPLETE_RUN_ABORTED", { questId: entry.questId, questName: entry.questName });
        } else {
            QL.error("AUTO_COMPLETE_RUN_ERROR", { questId: entry.questId, questName: entry.questName, error });
        }
    } finally {
        clearEntryTimers(entry);

        if (activeAutoCompletes.get(entry.questId) !== entry) {
            return;
        }

        activeAutoCompletes.delete(entry.questId);
        updateResumeState();

        if (!getQuestifySettings().autoCompleteQuestsSimultaneously && !suppressQueueDrain) {
            runNextQueuedQuest();
        }
        rerenderQuests();
    }
}

function runNextQueuedQuest(): void {
    if (suppressQueueDrain || getQuestifySettings().autoCompleteQuestsSimultaneously || Array.from(activeAutoCompletes.values()).some(entry => entry.status === "running")) {
        return;
    }

    for (const entry of activeAutoCompletes.values()) {
        if (entry.status !== "queued") continue;

        const quest = QuestStore.getQuest(entry.questId);

        if (quest) {
            void runEntry(quest, entry);
            return;
        }

        activeAutoCompletes.delete(entry.questId);
        updateResumeState();
    }
}

export function processQuestForAutoComplete(quest: Quest, options: AutoCompleteStartOptions = {}): boolean {
    const { source = "manual" } = options;
    const questName = normalizeQuestName(quest);
    const existingEntry = activeAutoCompletes.get(quest.id);

    if (!isAutoCompleteRuntimeReady(true)) {
        return false;
    }

    if (existingEntry) {
        return true;
    }

    if (quest.userStatus?.completedAt || getQuestStatus(quest, getIgnoredQuestIDs()) !== QuestStatus.Unclaimed) {
        QL.warn("AUTO_COMPLETE_INCOMPATIBLE_STATUS", { questId: quest.id, questName });
        return false;
    }

    const resolvedQuest = resolveAutoCompleteQuest(quest);

    if (!resolvedQuest) {
        QL.warn("AUTO_COMPLETE_INCOMPATIBLE_TASKS", { questId: quest.id, questName });
        return false;
    }

    const entry = createAutoCompleteEntry(quest, resolvedQuest.task, resolvedQuest.kind);

    activeAutoCompletes.set(quest.id, entry);

    if (getQuestifySettings().autoCompleteQuestsSimultaneously) {
        void runEntry(quest, entry);
    } else {
        updateResumeState();
        runNextQueuedQuest();
    }

    QL.info("AUTO_COMPLETE_STARTED", {
        questId: quest.id,
        questName,
        source,
        mode: getQuestifySettings().autoCompleteQuestsSimultaneously ? "simultaneous" : "queue",
        taskType: entry.task.type,
    });

    return true;
}

export function isQueueAllAutoCompleteQuestsInProgress(): boolean {
    return queueAllAutoCompleteQuestsAbortController !== null;
}

function stopQueueAllAutoCompleteQuests(): void {
    queueAllAutoCompleteQuestsAbortController?.abort();
}

export async function queueAllAutoCompleteQuests(): Promise<number> {
    if (
        queueAllAutoCompleteQuestsAbortController !== null ||
        getQuestifySettings().autoCompleteQuestsSimultaneously ||
        isQuestEnrollmentRateLimited()
    ) {
        return 0;
    }

    const abortController = new AbortController();
    const { signal } = abortController;

    queueAllAutoCompleteQuestsAbortController = abortController;

    try {
        let queued = 0;
        let enrollmentAttempts = 0;
        let nonRateLimitEnrollmentFailures = 0;
        let first = true;

        for (const quest of getQueueableAutoCompleteQuests()) {
            if (signal.aborted) {
                break;
            }

            if (!first) {
                try {
                    await sleep(1000, signal);
                } catch (error) {
                    if (signal.aborted) {
                        break;
                    }

                    throw error;
                }
            }

            first = false;
            const refreshedQuest = refreshQuest(quest);

            if (!refreshedQuest.userStatus?.enrolledAt) {
                if (enrollmentAttempts >= maxBatchEnrollmentAttempts) {
                    break;
                }

                enrollmentAttempts++;
            }

            const enrollment = await ensureQuestEnrolledForAutoComplete(refreshedQuest, { method: "manual" });

            if (signal.aborted) {
                break;
            }

            if (enrollment.type !== "success") {
                if (enrollment.type === "rate_limited") {
                    break;
                }

                nonRateLimitEnrollmentFailures++;

                if (nonRateLimitEnrollmentFailures >= maxBatchNonRateLimitEnrollmentFailures) {
                    break;
                }

                continue;
            }

            if (processQuestForAutoComplete(refreshQuest(refreshedQuest), { source: "manual" })) {
                queued++;
            }
        }

        return queued;
    } finally {
        if (queueAllAutoCompleteQuestsAbortController === abortController) {
            queueAllAutoCompleteQuestsAbortController = null;
        }
    }
}

export function stopQuestAutoComplete(questOrId: Quest | string, options: AutoCompleteStopOptions = {}): boolean {
    const { manual = true, preserveResume = false, terminalHeartbeat = false } = options;
    const questId = typeof questOrId === "string" ? questOrId : questOrId.id;
    const entry = activeAutoCompletes.get(questId);
    const resumeQuestIds = preserveResume ? getResumeQuestIds() : undefined;

    if (!entry) {
        updateResumeState(resumeQuestIds);
        return false;
    }

    clearEntryTimers(entry);
    entry.abortController.abort();
    activeAutoCompletes.delete(questId);

    const quest = typeof questOrId === "string" ? QuestStore.getQuest(questId) : questOrId;

    if (terminalHeartbeat && quest && entry.kind === "play" && entry.status === "running") {
        void reportPlayQuestProgress(refreshQuest(quest), entry, true, { attempts: 1 });
    }

    updateResumeState(resumeQuestIds);

    if (!getQuestifySettings().autoCompleteQuestsSimultaneously && !suppressQueueDrain) {
        runNextQueuedQuest();
    }

    QL.info("AUTO_COMPLETE_STOPPED", { questId, manual, preserveResume, terminalHeartbeat });
    return true;
}

export function stopAllAutoCompletes(options: AutoCompleteStopOptions = {}): void {
    stopQueueAllAutoCompleteQuests();

    const resumeQuestIds = options.preserveResume ? getResumeQuestIds() : undefined;

    suppressQueueDrain = true;

    try {
        for (const questId of Array.from(activeAutoCompletes.keys())) {
            stopQuestAutoComplete(questId, options);
        }

        updateResumeState(resumeQuestIds);
    } finally {
        suppressQueueDrain = false;
    }
}

export function stopAutoCompletesForRunningGames(gameIds: string[]): boolean {
    let stoppedAny = false;

    for (const entry of Array.from(activeAutoCompletes.values())) {
        const quest = QuestStore.getQuest(entry.questId);

        if (entry.kind === "play" && quest && entry.task.applications?.some(({ id }) => gameIds.includes(id))) {
            stopQuestAutoComplete(quest, { manual: false, preserveResume: false });
            stoppedAny = true;
        }
    }

    if (stoppedAny) {
        rerenderQuests();
    }

    return stoppedAny;
}

export function resumeInterruptedAutoCompletes(): void {
    if (!getQuestifySettings().resumeInterruptedQuests) {
        return;
    }

    const userId = getCurrentUserId();
    const resumeState = userId ? getQuestifySettings().resumeQuestIDs[userId] : null;

    if (!userId || !resumeState?.questIDs.length) {
        return;
    }

    if (isResumeStateExpired(resumeState.timestamp)) {
        delete getQuestifySettings().resumeQuestIDs[userId];
        QL.info("AUTO_COMPLETE_RESUME_EXPIRED", { userId, timestamp: resumeState.timestamp, maxAge: resumeExpiryMs });
        return;
    }

    const resumeQuestIds = Array.from(new Set(resumeState.questIDs));
    const resumableQuests = resumeQuestIds
        .map(questId => QuestStore.getQuest(questId))
        .filter((quest): quest is Quest => quest != null);

    if (resumableQuests.length === 0) {
        updateResumeState();
        return;
    }

    QL.info("AUTO_COMPLETE_RESUME_INTERRUPTED", {
        userId,
        timestamp: resumeState.timestamp,
        questIDs: resumeQuestIds,
    });

    const resumedQuestIds = new Set<string>();

    for (const quest of resumableQuests) {
        if (processQuestForAutoComplete(quest, { source: "resume" })) {
            resumedQuestIds.add(quest.id);
        }
    }

    updateResumeState();

    const droppedQuestIds = resumeQuestIds.filter(questId => !resumedQuestIds.has(questId));

    if (droppedQuestIds.length > 0) {
        QL.warn("AUTO_COMPLETE_RESUME_DROPPED_QUESTS", {
            userId,
            questIDs: droppedQuestIds,
        });
    }
}

export function getActiveAutoCompletes(): readonly Readonly<AutoCompleteEntry>[] {
    return Array.from(activeAutoCompletes.values());
}
