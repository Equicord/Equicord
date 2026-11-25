/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { getIntlMessage } from "@utils/discord";
import type { Quest, QuestTaskWatchVideo, QuestTaskWatchVideoOnMobile } from "@vencord/discord-types";
import { QuestTaskType } from "@vencord/discord-types/enums";
import { LocaleStore, QuestStore, useMemo, useState, useStateFromStores } from "@webpack/common";
import type { ReactNode } from "react";

import { getQuestifySettings, useQuestifySettings } from "../settings/access";
import { defaultClaimedSubsort, defaultExpiredSubsort, defaultIgnoredSubsort, defaultQuestOrder, defaultUnclaimedSubsort, type QuestOrderStatus, type QuestSubsort, type QuestTileColorSetting, type QuestTileGradient } from "../settings/def";
import { getIgnoredQuestIDs } from "../settings/ignoredQuests";
import { useQuestRerender } from "../settings/rerender";
import { markInjectedDesktopVideoTask } from "../state";
import { hasEnabledAutoCompleteTaskType, questTaskMatchesAutoCompleteCombinations } from "./filtering";
import { getQuestStatus, isQuestHidden, QuestStatus } from "./questState";
import { adjustRGB, decimalToRGB, isDarkish, q, type RGB } from "./ui";

type QuestGroupKey = "claimed" | "expired" | "ignored" | "unclaimed" | "unknown";

export interface QuestHomeHero {
    id: string;
    questIds?: string[] | null;
}

interface QuestPageVisibility {
    showHiddenQuests: boolean;
    setShowHiddenQuests: (checked: boolean) => void;
}

export interface QuestHomeHeroState<THero extends QuestHomeHero = QuestHomeHero> extends QuestPageVisibility {
    hideBanner: boolean;
    questHomeHero: THero | null;
    isLoading: boolean;
    confirmedEmpty: boolean;
}

interface QuestTileColorSettings {
    questTileUnclaimedColor: QuestTileColorSetting;
    questTileClaimedColor: QuestTileColorSetting;
    questTileIgnoredColor: QuestTileColorSetting;
    questTileExpiredColor: QuestTileColorSetting;
}

const customQuestTileClasses = [
    q("quest-item-restyle"),
    q("quest-item-intense-gradient"),
    q("quest-item-default-gradient"),
    q("quest-item-black-gradient"),
    q("quest-item-hide-gradient"),
    q("quest-item-contrast-logo"),
];

const sortFallbacks = {
    unclaimed: defaultUnclaimedSubsort,
    claimed: defaultClaimedSubsort,
    ignored: defaultIgnoredSubsort,
    expired: defaultExpiredSubsort,
} as const satisfies Record<string, QuestSubsort>;

const validSubsorts = new Set<QuestSubsort>([
    "Recent ASC",
    "Recent DESC",
    "Expiring ASC",
    "Expiring DESC",
    "Claimed ASC",
    "Claimed DESC",
]);

function getTileColorSetting(status: QuestStatus, colors: QuestTileColorSettings): QuestTileColorSetting | null {
    switch (status) {
        case QuestStatus.Claimed:
            return colors.questTileClaimedColor;
        case QuestStatus.Unclaimed:
            return colors.questTileUnclaimedColor;
        case QuestStatus.Ignored:
            return colors.questTileIgnoredColor;
        case QuestStatus.Expired:
            return colors.questTileExpiredColor;
        default:
            return null;
    }
}

function getQuestTileColor(quest: Quest & { dummyColor?: QuestTileColorSetting; }, colors: QuestTileColorSettings): number | null {
    const questStatus = getQuestStatus(quest, getIgnoredQuestIDs());
    const setting = quest.dummyColor ?? getTileColorSetting(questStatus, colors);

    if (!setting?.enabled) {
        return null;
    }

    return setting.color;
}

function getGradientClass(gradient: QuestTileGradient): string | null {
    if (gradient === "black") return q("quest-item-black-gradient");
    if (gradient === "hide") return q("quest-item-hide-gradient");
    if (gradient === "default") return q("quest-item-default-gradient");

    return q("quest-item-intense-gradient");
}

export function getQuestTileClasses(originalClasses: string, quest: Quest & { dummyColor?: QuestTileColorSetting; }, gradientOverride?: QuestTileGradient): string {
    const questTiles = useQuestifySettings([
        "disableQuestsEverything",
        "ignoredQuestIDs",
        "questTileUnclaimedColor",
        "questTileClaimedColor",
        "questTileIgnoredColor",
        "questTileExpiredColor",
        "questTileGradient",
    ]);

    const baseClasses = originalClasses
        .split(" ")
        .filter(cls => cls && !customQuestTileClasses.includes(cls));
    const colors: QuestTileColorSettings = {
        questTileUnclaimedColor: questTiles.questTileUnclaimedColor as QuestTileColorSetting,
        questTileClaimedColor: questTiles.questTileClaimedColor as QuestTileColorSetting,
        questTileIgnoredColor: questTiles.questTileIgnoredColor as QuestTileColorSetting,
        questTileExpiredColor: questTiles.questTileExpiredColor as QuestTileColorSetting,
    };
    const color = !questTiles.disableQuestsEverything
        ? getQuestTileColor(quest, colors)
        : null;

    if (color == null) {
        return baseClasses.join(" ");
    }

    const returnClasses = [...baseClasses, q("quest-item-restyle")];
    const gradient = gradientOverride ?? questTiles.questTileGradient as QuestTileGradient;
    const gradientClass = getGradientClass(gradient);

    if (gradientClass != null) {
        returnClasses.push(gradientClass);
    }

    if (gradient !== "black" && gradient !== "hide" && !isDarkish(decimalToRGB(color), 0.875)) {
        returnClasses.push(q("quest-item-contrast-logo"));
    }

    return returnClasses.join(" ");
}

export function getQuestTileStyle(quest: (Quest & { dummyColor?: QuestTileColorSetting; }) | null): Record<string, string> {
    const questTiles = useQuestifySettings([
        "disableQuestsEverything",
        "ignoredQuestIDs",
        "questTileUnclaimedColor",
        "questTileClaimedColor",
        "questTileIgnoredColor",
        "questTileExpiredColor",
    ]);

    const style: Record<string, string> = {};
    const colors: QuestTileColorSettings = {
        questTileUnclaimedColor: questTiles.questTileUnclaimedColor as QuestTileColorSetting,
        questTileClaimedColor: questTiles.questTileClaimedColor as QuestTileColorSetting,
        questTileIgnoredColor: questTiles.questTileIgnoredColor as QuestTileColorSetting,
        questTileExpiredColor: questTiles.questTileExpiredColor as QuestTileColorSetting,
    };
    const themeColor = quest && !questTiles.disableQuestsEverything
        ? getQuestTileColor(quest, colors)
        : null;

    if (themeColor == null) return style;

    const rgb = decimalToRGB(themeColor);
    const darkish = isDarkish(rgb);
    const sign = darkish ? 1 : -1;
    const questNameColor = adjustRGB(rgb, 200 * sign);
    const rewardTitleColor = adjustRGB(rgb, 150 * sign);
    const rewardDescriptionColor = adjustRGB(rgb, 100 * sign);
    const buttonNormalColor = adjustRGB(rgb, 50 * sign);
    const buttonHoverColor = adjustRGB(rgb, 75 * sign);

    function toRGB(value: RGB): string {
        return `rgb(${value.r}, ${value.g}, ${value.b})`;
    }

    style["--questify-color"] = toRGB(rgb);
    style["--questify-quest-name"] = toRGB(questNameColor);
    style["--questify-reward-title"] = toRGB(rewardTitleColor);
    style["--questify-reward-description"] = toRGB(rewardDescriptionColor);
    style["--questify-button-normal"] = toRGB(buttonNormalColor);
    style["--questify-button-hover"] = toRGB(buttonHoverColor);

    return style;
}

export function getQuestClaimDeadlineText(quest: Quest): ReactNode {
    const { config, userStatus } = quest;
    const rewardsExpireAt = config.rewardsConfig?.rewardsExpireAt;
    const deadline = new Date(rewardsExpireAt);

    if (userStatus?.completedAt == null || userStatus.claimedAt != null || !rewardsExpireAt) return null;
    if (!Number.isFinite(deadline.getTime())) return null;

    const expirationDate = deadline.toLocaleDateString(LocaleStore.locale, { month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" });

    return getIntlMessage("QUESTS_CLAIM_BY_DATE", { expirationDate });
}

function createSortFunction(subsort: QuestSubsort): (a: Quest, b: Quest) => number {
    switch (subsort) {
        case "Recent ASC":
            return (a, b) => new Date(a.config.startsAt).getTime() - new Date(b.config.startsAt).getTime();
        case "Recent DESC":
            return (a, b) => new Date(b.config.startsAt).getTime() - new Date(a.config.startsAt).getTime();
        case "Expiring ASC":
            return (a, b) => new Date(a.config.expiresAt).getTime() - new Date(b.config.expiresAt).getTime();
        case "Expiring DESC":
            return (a, b) => new Date(b.config.expiresAt).getTime() - new Date(a.config.expiresAt).getTime();
        case "Claimed ASC":
            return (a, b) => new Date(a.userStatus?.claimedAt || 0).getTime() - new Date(b.userStatus?.claimedAt || 0).getTime();
        case "Claimed DESC":
            return (a, b) => new Date(b.userStatus?.claimedAt || 0).getTime() - new Date(a.userStatus?.claimedAt || 0).getTime();
    }
}

function getValidSubsort(value: unknown, fallback: QuestSubsort): QuestSubsort {
    return validSubsorts.has(value as QuestSubsort) ? value as QuestSubsort : fallback;
}

function getValidQuestOrder(value: unknown): QuestOrderStatus[] {
    const validStatuses = new Set<QuestOrderStatus>(defaultQuestOrder);
    const configuredOrder = Array.isArray(value)
        ? value
        : defaultQuestOrder;
    const order = Array.from(new Set(configuredOrder.filter((status): status is QuestOrderStatus => validStatuses.has(status as QuestOrderStatus))));

    for (const status of defaultQuestOrder) {
        if (!order.includes(status)) {
            order.push(status);
        }
    }

    return order;
}

function injectDesktopVideoQuestTasks(quests: Quest[], includeQuest: (quest: Quest) => boolean): void {
    for (const quest of quests) {
        if (!includeQuest(quest)) {
            continue;
        }

        const tasks = quest.config.taskConfigV2?.tasks;
        const mobileVideoTask = tasks?.[QuestTaskType.WATCH_VIDEO_ON_MOBILE] as QuestTaskWatchVideoOnMobile | undefined;

        if (!tasks || !mobileVideoTask || tasks[QuestTaskType.WATCH_VIDEO]) {
            continue;
        }

        const desktopVideoTask: QuestTaskWatchVideo = {
            ...mobileVideoTask,
            type: QuestTaskType.WATCH_VIDEO,
        };

        markInjectedDesktopVideoTask(desktopVideoTask);

        const reorderedTasks: typeof tasks = {};

        for (const [taskType, task] of Object.entries(tasks) as [QuestTaskType, typeof tasks[QuestTaskType]][]) {
            if (taskType === QuestTaskType.WATCH_VIDEO_ON_MOBILE) {
                reorderedTasks[QuestTaskType.WATCH_VIDEO] = desktopVideoTask;
            }

            reorderedTasks[taskType] = task;
        }

        quest.config.taskConfigV2.tasks = reorderedTasks;
    }
}

export function useQuestHomeVisibility<THero extends QuestHomeHero>(
    hero: THero | null,
    isLoading: boolean,
    confirmedEmpty: boolean,
): QuestHomeHeroState<THero> {
    const settings = useQuestifySettings([
        "disableQuestsEverything",
        "disableSponsoredBanner",
        "ignoredQuestIDs",
        "hiddenQuestStatuses",
        "hiddenQuestCombinations",
        "hiddenQuestTerms",
        "hideNonAutoCompletableQuests",
        "autoCompleteQuestCombinations",
    ]);
    const questRerenderTrigger = useQuestRerender();
    const [showHiddenQuests, setShowHiddenQuests] = useState(false);
    const quests = useStateFromStores([QuestStore], () => QuestStore.quests);
    const hideBanner = settings.disableQuestsEverything || settings.disableSponsoredBanner;
    const ignoredQuestIdsKey = getIgnoredQuestIDs().join("|");
    const hiddenStatusesKey = Array.isArray(settings.hiddenQuestStatuses) ? settings.hiddenQuestStatuses.join("|") : "";
    const hiddenCombinationsKey = Array.isArray(settings.hiddenQuestCombinations) ? settings.hiddenQuestCombinations.join("|") : "";
    const autoCompleteCombinationsKey = Array.isArray(settings.autoCompleteQuestCombinations) ? settings.autoCompleteQuestCombinations.join("|") : "";

    const heroState = useMemo(() => {
        if (hideBanner) {
            return { questHomeHero: null, isLoading: false, confirmedEmpty: true };
        }

        if (showHiddenQuests || !hero || !Array.isArray(hero.questIds) || hero.questIds.length === 0) {
            return { questHomeHero: hero, isLoading, confirmedEmpty };
        }

        const ignoredQuestIds = ignoredQuestIdsKey ? ignoredQuestIdsKey.split("|") : [];
        let hasAccessibleQuest = false;
        let hasHiddenQuest = false;
        const visibleQuestIds: string[] = [];

        for (const questId of hero.questIds) {
            const quest = quests.get(questId);

            if (!quest) {
                visibleQuestIds.push(questId);
                continue;
            }

            hasAccessibleQuest = true;

            if (isQuestHidden(quest, ignoredQuestIds)) {
                hasHiddenQuest = true;
            } else {
                visibleQuestIds.push(questId);
            }
        }

        if (!hasHiddenQuest) {
            return { questHomeHero: hero, isLoading, confirmedEmpty };
        }

        const hasVisibleAccessibleQuest = visibleQuestIds.some(questId => quests.has(questId));

        if (hasAccessibleQuest && !hasVisibleAccessibleQuest) {
            return { questHomeHero: null, isLoading: false, confirmedEmpty: true };
        }

        return { questHomeHero: { ...hero, questIds: visibleQuestIds }, isLoading, confirmedEmpty };
    }, [
        hero,
        isLoading,
        confirmedEmpty,
        showHiddenQuests,
        quests,
        hideBanner,
        ignoredQuestIdsKey,
        hiddenStatusesKey,
        hiddenCombinationsKey,
        settings.hiddenQuestTerms,
        settings.hideNonAutoCompletableQuests,
        autoCompleteCombinationsKey,
        questRerenderTrigger,
    ]);

    return { ...heroState, hideBanner, showHiddenQuests, setShowHiddenQuests };
}

// The Claimed tab supplies its own list and only uses Questify's sort.
export function sortQuests(quests: Quest[], page?: { sortMethod?: string; showHiddenQuests?: boolean; }): Quest[] {
    const questSorting = useQuestifySettings([
        "disableQuestsEverything",
        "ignoredQuestIDs",
        "makeMobileVideoQuestsDesktopCompatible",
        "completeVideoQuestsQuicker",
        "questOrder",
        "hiddenQuestStatuses",
        "hiddenQuestCombinations",
        "hiddenQuestTerms",
        "hideNonAutoCompletableQuests",
        "unclaimedSubsort",
        "claimedSubsort",
        "ignoredSubsort",
        "expiredSubsort",
        "autoCompleteQuestCombinations",
    ]);

    if (questSorting.disableQuestsEverything) {
        return quests;
    }

    const ignoredQuestIds = getIgnoredQuestIDs();

    if (page) {
        const hasHiddenQuests = questSorting.hiddenQuestStatuses.length > 0
            || questSorting.hideNonAutoCompletableQuests
            || questSorting.hiddenQuestCombinations.length > 0
            || questSorting.hiddenQuestTerms.trim().length > 0;

        const displayedQuests = !page.showHiddenQuests && hasHiddenQuests
            ? quests.filter(quest => !isQuestHidden(quest, ignoredQuestIds))
            : quests;
        const injectAllDesktopVideo = questSorting.makeMobileVideoQuestsDesktopCompatible;
        const injectAutoCompleteDesktopVideo = hasEnabledAutoCompleteTaskType(questSorting.autoCompleteQuestCombinations, QuestTaskType.WATCH_VIDEO_ON_MOBILE);

        if (injectAllDesktopVideo || injectAutoCompleteDesktopVideo) {
            injectDesktopVideoQuestTasks(displayedQuests, quest =>
                injectAllDesktopVideo
                || questTaskMatchesAutoCompleteCombinations(quest, QuestTaskType.WATCH_VIDEO_ON_MOBILE, questSorting.autoCompleteQuestCombinations)
            );
        }

        quests = displayedQuests;

        if (page.sortMethod !== "questify") {
            // Discord's native sort can mutate the unfiltered list in place.
            return page.showHiddenQuests ? [...quests] : quests;
        }
    }

    const questGroups: Record<QuestGroupKey, Quest[]> = {
        claimed: [],
        expired: [],
        ignored: [],
        unclaimed: [],
        unknown: [],
    };

    for (const quest of quests) {
        switch (getQuestStatus(quest, ignoredQuestIds)) {
            case QuestStatus.Claimed:
                questGroups.claimed.push(quest);
                break;
            case QuestStatus.Unclaimed:
                questGroups.unclaimed.push(quest);
                break;
            case QuestStatus.Expired:
                questGroups.expired.push(quest);
                break;
            case QuestStatus.Ignored:
                questGroups.ignored.push(quest);
                break;
            default:
                questGroups.unknown.push(quest);
                break;
        }
    }

    const unclaimedSortFunction = createSortFunction(getValidSubsort(questSorting.unclaimedSubsort, sortFallbacks.unclaimed));

    questGroups.unclaimed.sort((a, b) => {
        const aCompleted = !!a.userStatus?.completedAt;
        const bCompleted = !!b.userStatus?.completedAt;

        if (aCompleted !== bCompleted) {
            return aCompleted ? 1 : -1;
        }

        return unclaimedSortFunction(a, b);
    });

    questGroups.claimed.sort(createSortFunction(getValidSubsort(questSorting.claimedSubsort, sortFallbacks.claimed)));
    questGroups.ignored.sort(createSortFunction(getValidSubsort(questSorting.ignoredSubsort, sortFallbacks.ignored)));
    questGroups.expired.sort(createSortFunction(getValidSubsort(questSorting.expiredSubsort, sortFallbacks.expired)));

    return [
        ...getValidQuestOrder(questSorting.questOrder).flatMap(status => questGroups[status.toLowerCase() as QuestGroupKey]),
        ...questGroups.unknown,
    ];
}

export function appendHiddenQuestStatuses(quests: Quest[]): Quest[] {
    const { hiddenQuestStatuses } = getQuestifySettings();

    if (!hiddenQuestStatuses.length) return quests;

    const visible: Quest[] = [];
    const hiddenGroups = new Map<string, Quest[]>();
    const ignoredQuestIds = getIgnoredQuestIDs();

    for (const status of defaultQuestOrder) {
        if (hiddenQuestStatuses.includes(status)) hiddenGroups.set(status, []);
    }

    for (const quest of quests) {
        const group = hiddenGroups.get(getQuestStatus(quest, ignoredQuestIds)) ?? visible;
        group.push(quest);
    }

    return visible.concat(...hiddenGroups.values());
}

interface QuestPageFilter {
    group: string;
    filter: string;
}

const showHiddenFilter = { group: "questify", filter: "show_hidden_quests", label: "Show Hidden Quests" };
export const questifyFilterGroup = { heading: "Questify", options: [showHiddenFilter] };

export function getQuestFilterMenuProps(
    selectedFilters: QuestPageFilter[],
    onChange: (filters: QuestPageFilter[]) => void,
    { showHiddenQuests, setShowHiddenQuests }: QuestPageVisibility,
) {
    return {
        selectedFilters: showHiddenQuests ? [...selectedFilters, showHiddenFilter] : selectedFilters,
        onChange(filters: QuestPageFilter[]) {
            const nativeFilters = filters.filter(filter => filter.group !== showHiddenFilter.group);
            setShowHiddenQuests(nativeFilters.length !== filters.length);

            if (nativeFilters.length !== selectedFilters.length || nativeFilters.some((filter, index) => filter !== selectedFilters[index])) {
                onChange(nativeFilters);
            }
        },
    };
}

export function shouldPreloadQuestAssets(): boolean {
    const settings = getQuestifySettings();

    return !settings.disableQuestsEverything && settings.questTilePreload;
}

export function getLastSortChoice(): string | null {
    const { rememberQuestPageSort, lastQuestPageSort } = getQuestifySettings();

    return rememberQuestPageSort ? lastQuestPageSort : "questify";
}

export function setLastSortChoice(sort: string): void {
    getQuestifySettings().lastQuestPageSort = sort || "questify";
}

function getFilterChoiceKey({ group, filter }: QuestPageFilter): string {
    return JSON.stringify([group, filter]);
}

function serializeFilterChoices(filters: readonly QuestPageFilter[]): string {
    return JSON.stringify(filters.map(({ group, filter }) => [group, filter]));
}

function getLastFilterChoices(): QuestPageFilter[] | null {
    const { rememberQuestPageFilters, lastQuestPageFilters } = getQuestifySettings();

    if (!rememberQuestPageFilters) {
        return null;
    }

    return (Object.values(lastQuestPageFilters ?? {}) as QuestPageFilter[])
        .filter(item => Boolean(item?.group && item?.filter))
        .map(({ group, filter }) => ({ group, filter }));
}

let cachedResolvedFiltersKey: string | null = null;
let cachedResolvedFilters: QuestPageFilter[] = [];

export function resolveFilterChoices(urlFilters: QuestPageFilter[] | null, fallback: QuestPageFilter[]): QuestPageFilter[] {
    const filters = urlFilters ?? getLastFilterChoices() ?? fallback;

    if (filters.length === 0) {
        return fallback;
    }

    const key = serializeFilterChoices(filters);

    if (key !== cachedResolvedFiltersKey) {
        cachedResolvedFiltersKey = key;
        cachedResolvedFilters = filters.map(({ group, filter }) => ({ group, filter }));
    }

    return cachedResolvedFilters;
}

export function setLastFilterChoices(filters: QuestPageFilter[] | null): void {
    const currentMap = getQuestifySettings().lastQuestPageFilters ?? {};

    if (!filters?.length) {
        if (Object.keys(currentMap).length > 0) {
            getQuestifySettings().lastQuestPageFilters = {};
        }

        return;
    }

    if (!filters.every(filter => filter?.group && filter?.filter)) {
        return;
    }

    const nextMap = filters.reduce((acc, { group, filter }) => {
        const item = { group, filter };
        acc[getFilterChoiceKey(item)] = item;

        return acc;
    }, {} as Record<string, QuestPageFilter>);

    const currentEntries = (Object.values(currentMap) as QuestPageFilter[])
        .filter(item => Boolean(item?.group && item?.filter));
    const nextEntries = Object.values(nextMap);

    if (
        Object.keys(currentMap).length === nextEntries.length
        && serializeFilterChoices(currentEntries) === serializeFilterChoices(nextEntries)
    ) {
        return;
    }

    getQuestifySettings().lastQuestPageFilters = nextMap;
}
