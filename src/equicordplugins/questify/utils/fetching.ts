/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { playAudio } from "@api/AudioPlayer";
import { showNotification } from "@api/Notifications";
import { sleep } from "@utils/misc";
import type { PluginNative } from "@utils/types";
import type { Quest, QuestUserStatus } from "@vencord/discord-types";
import { findByCodeLazy } from "@webpack";
import { QuestStore, RestAPI, UserStore } from "@webpack/common";
import { NavigationRouter } from "@webpack/common/utils";

import { getQuestifySettings } from "../settings/access";
import { getIgnoredQuestIDs } from "../settings/ignoredQuests";
import { initialQuestDataFetched } from "../state";
import { getNewQuests, normalizeQuestName, questMatchesIncludedTypes } from "./filtering";
import { QL } from "./logging";
import { QUEST_PAGE } from "./ui";

const QuestifyNative = VencordNative?.pluginHelpers?.Questify as PluginNative<typeof import("../native")> | undefined;

export const fetchAndDispatchQuests = findByCodeLazy("QUESTS_FETCH_CURRENT_QUESTS_BEGIN");
export const parseQuestUserStatus = findByCodeLazy("enrolledAt:", ".enrolled_at", "progress:") as (status: unknown) => QuestUserStatus;
const parseQuestConfig = findByCodeLazy("config).with({config_version:");
const formatQuestData = findByCodeLazy("config),userStatus:null==");

async function fetchQuestById(questId: string): Promise<Quest | null> {
    try {
        const { body } = await RestAPI.get({ url: `/quests/${questId}`, retries: 3 });
        const valid = !!parseQuestConfig({ config: body });

        if (!valid) {
            QL.warn("FETCH_QUEST_BY_ID_INVALID_BODY", { questId, body });

            return null;
        }

        return formatQuestData(body);
    } catch (error: unknown) {
        QL.warn("FETCH_QUEST_BY_ID_FAILED", { questId, error });

        return null;
    }
}

async function fetchExcludedQuestConfigs(questIds: string[], userId: string): Promise<Quest[]> {
    const quests: Quest[] = [];

    for (const [index, questId] of questIds.entries()) {
        if (index > 0) {
            await sleep(1000);
        }

        const settings = getQuestifySettings();
        if (!settings.enabled || settings.disableQuestsEverything || UserStore.getCurrentUser()?.id !== userId) break;

        const quest = await fetchQuestById(questId);

        if (quest) {
            quests.push(quest);
        }
    }

    return quests;
}

export function canOpenDevToolsWindow(): boolean {
    return typeof QuestifyNative?.openDevTools === "function";
}

export async function openDevToolsWindow(): Promise<boolean> {
    return QuestifyNative?.openDevTools() ?? false;
}

function getQuestNotificationText(quests: Quest[], excluded: boolean): { title: string; body: string; } {
    const firstQuest = quests[0];
    const firstQuestName = normalizeQuestName(firstQuest);

    if (quests.length === 1) {
        return {
            title: excluded ? "New Excluded Quest Detected!" : "New Quest Detected!",
            body: excluded
                ? `The excluded ${firstQuestName} Quest was detected. ID: ${firstQuest.id}`
                : `The ${firstQuestName} Quest is now available.`
        };
    }

    return {
        title: excluded ? "New Excluded Quests Detected!" : "New Quests Detected!",
        body: excluded
            ? `${quests.length} new excluded Quests were detected. Check the console for their Quest IDs.`
            : `${quests.length} new Quests are now available.`
    };
}

function notifyNewQuests(quests: Quest[], excluded: boolean): void {
    if (quests.length === 0) return;

    const firstQuest = quests[0];
    const { title, body } = getQuestNotificationText(quests, excluded);
    const onClick = excluded
        ? canOpenDevToolsWindow() ? openDevToolsWindow : undefined
        : () => NavigationRouter.transitionTo(`${QUEST_PAGE}#${firstQuest.id}`);

    showNotification({
        title,
        body,
        dismissOnClick: true,
        onClick
    });

    QL.log("NOTIFY_NEW_QUESTS", { excluded, quests });
}

export async function fetchAndAlertQuests(source: string): Promise<Quest[] | null> {
    const settings = getQuestifySettings();
    if (!settings.enabled || settings.disableQuestsEverything || QuestStore.isFetchingCurrentQuests) return null;

    const userId = UserStore.getCurrentUser()?.id;
    if (!userId) return null;
    const hadQuestData = initialQuestDataFetched;
    const shouldFetchExcludedQuests = settings.notifyOnNewExcludedQuests || Boolean(settings.newExcludedQuestAlertSound);
    const currentQuests = Array.from(QuestStore.quests.values());
    const currentExcludedQuestIds = new Set(Array.from(QuestStore.excludedQuests.values()).map(quest => quest.id));

    await fetchAndDispatchQuests();

    if (!settings.enabled || settings.disableQuestsEverything || UserStore.getCurrentUser()?.id !== userId) return null;

    const nextQuests = Array.from(QuestStore.quests.values());

    if (!hadQuestData) {
        return nextQuests;
    }

    const newQuests = getNewQuests(currentQuests, nextQuests);
    const newExcludedQuestIds = shouldFetchExcludedQuests
        ? Array.from(QuestStore.excludedQuests.values())
            .map(quest => quest.id)
            .filter(questId => !currentExcludedQuestIds.has(questId))
        : [];

    if (newQuests.length === 0 && newExcludedQuestIds.length === 0) {
        return nextQuests;
    }

    const newExcludedQuests = newExcludedQuestIds.length > 0 ? await fetchExcludedQuestConfigs(newExcludedQuestIds, userId) : [];
    if (!settings.enabled || settings.disableQuestsEverything || UserStore.getCurrentUser()?.id !== userId) return null;

    const alertSound = settings.newQuestAlertSound;
    const alertVolume = settings.newQuestAlertVolume;
    const excludedAlertSound = settings.newExcludedQuestAlertSound;
    const excludedAlertVolume = settings.newExcludedQuestAlertVolume;
    const includedTypes = settings.questButtonIncludedTypes;
    const ignoredQuestIds = new Set(getIgnoredQuestIDs());

    const newIncludedQuests = newQuests.filter(quest => questMatchesIncludedTypes(quest, includedTypes) && !ignoredQuestIds.has(quest.id));
    const newIncludedExcludedQuests = newExcludedQuests.filter(quest => questMatchesIncludedTypes(quest, includedTypes) && !ignoredQuestIds.has(quest.id));
    const shouldAlert = Boolean(alertSound) && newIncludedQuests.length > 0;
    const shouldAlertExcluded = Boolean(excludedAlertSound) && newIncludedExcludedQuests.length > 0;
    const shouldNotify = settings.notifyOnNewQuests && newIncludedQuests.length > 0;
    const shouldNotifyExcluded = settings.notifyOnNewExcludedQuests && newIncludedExcludedQuests.length > 0;

    QL.info("FETCH_AND_ALERT_QUESTS_NEW_QUESTS", {
        source,
        newQuestCount: newQuests.length,
        newQuests: newIncludedQuests,
        matchedQuestCount: newIncludedQuests.length + newIncludedExcludedQuests.length,
        ...(shouldFetchExcludedQuests ? {
            newExcludedQuestCount: newExcludedQuestIds.length,
            newExcludedQuests: newIncludedExcludedQuests,
            matchedExcludedQuestCount: newIncludedExcludedQuests.length,
        } : {}),
        shouldAlert,
        shouldAlertExcluded,
        shouldNotify,
        shouldNotifyExcluded,
    });

    if (shouldAlert && alertSound) {
        playAudio(alertSound, { volume: alertVolume });
    }

    if (shouldAlertExcluded && excludedAlertSound) {
        playAudio(excludedAlertSound, { volume: excludedAlertVolume });
    }

    if (shouldNotify) {
        notifyNewQuests(newIncludedQuests, false);
    }

    if (shouldNotifyExcluded) {
        notifyNewQuests(newIncludedExcludedQuests, true);
    }

    return nextQuests;
}

let autoFetchInterval: null | ReturnType<typeof setInterval> = null;
const minimumAutoFetchIntervalValue = 30 * 60; // 30 minutes
const maximumAutoFetchIntervalValue = 12 * 60 * 60; // 12 hours

export function autoFetchCompatible(): boolean {
    const settings = getQuestifySettings();
    const {
        newExcludedQuestAlertSound,
        newQuestAlertSound,
        questFetchInterval,
        notifyOnNewExcludedQuests,
        notifyOnNewQuests,
        questButtonDisplay: displayMode,
        questButtonIndicator: indicatorMode
    } = settings;
    const fetching = settings.enabled && !settings.disableQuestsEverything && questFetchInterval > 0;
    const notificationsCompatible = notifyOnNewQuests || notifyOnNewExcludedQuests || Boolean(newQuestAlertSound) || Boolean(newExcludedQuestAlertSound);
    const buttonCompatible = displayMode === "unclaimed"
        || (displayMode === "always" && ["pill", "badge", "both"].includes(indicatorMode));

    return fetching && (buttonCompatible || notificationsCompatible);
}

export function startAutoFetchingQuests(force: boolean = false): void {
    if (!autoFetchCompatible()) {
        stopAutoFetchingQuests();

        return;
    }

    if (autoFetchInterval) {
        if (!force) {
            return;
        }

        stopAutoFetchingQuests();
    }

    const { questFetchInterval } = getQuestifySettings();
    const interval = Math.min(Math.max(questFetchInterval, minimumAutoFetchIntervalValue), maximumAutoFetchIntervalValue);
    autoFetchInterval = setInterval(() => { void fetchAndAlertQuests("AUTO_FETCH"); }, interval * 1000);
    QL.info("START_AUTO_FETCHING_QUESTS", { autoFetchIntervalID: autoFetchInterval, questFetchInterval, questFetchIntervalClamped: interval });
}

export function stopAutoFetchingQuests(): void {
    if (autoFetchInterval) {
        clearInterval(autoFetchInterval);
        autoFetchInterval = null;
        QL.info("STOP_AUTO_FETCHING_QUESTS");
    }
}
