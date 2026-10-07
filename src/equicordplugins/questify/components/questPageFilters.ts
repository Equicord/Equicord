/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { getQuestifySettings, useQuestifySettings } from "../settings/access";

interface QuestPageFilter {
    group: string;
    filter: string;
}

interface QuestPageFilterGroup {
    heading: string;
    options: QuestPageFilter[];
}

const pageFilterOptions = [
    { filter: "questify_included", setting: "filterQuestPage", label: "Hide excluded Quests" },
    { filter: "questify_unclaimed", setting: "hideClaimedQuests", label: "Hide claimed Quests" },
] as const;
const pageFilterSettingKeys = pageFilterOptions.map(option => option.setting);
const questifyGroup: QuestPageFilterGroup = {
    heading: "Visibility",
    options: pageFilterOptions.map(({ filter }) => ({ group: "questify", filter })),
};

export function getQuestPageFilterGroups(groups: QuestPageFilterGroup[]): QuestPageFilterGroup[] {
    return [...groups, questifyGroup];
}

export function getQuestPageFilterLabel(filter: string): string | undefined {
    return pageFilterOptions.find(option => option.filter === filter)?.label;
}

export function useQuestPageFilters(filters: QuestPageFilter[], onChange: (filters: QuestPageFilter[]) => void): [QuestPageFilter[], (filters: QuestPageFilter[]) => void] {
    const settings = useQuestifySettings(pageFilterSettingKeys);
    const selectedFilters = [
        ...filters,
        ...pageFilterOptions.filter(option => settings[option.setting]).map(({ filter }) => ({ group: "questify", filter })),
    ];

    function updateFilters(nextFilters: QuestPageFilter[]) {
        for (const option of pageFilterOptions) {
            getQuestifySettings()[option.setting] = nextFilters.some(filter => filter.group === "questify" && filter.filter === option.filter);
        }
        onChange(nextFilters.filter(filter => filter.group !== "questify"));
    }

    return [selectedFilters, updateFilters];
}
