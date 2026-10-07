/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { QuestRewardType, type QuestTaskType } from "@vencord/discord-types/enums";
import type { JSX } from "react";

import { getQuestifySettings, useQuestifySettings } from "../settings/access";
import { questTaskLabels, questTaskTypes } from "../settings/def";
import { validateIgnoredQuests } from "../settings/ignoredQuests";
import { settingTooltips } from "../settings/tooltips";
import { q } from "../utils/ui";
import { SettingsSelect, toManaOptions } from "./shared";

interface QuestIncludedTypeOption {
    label: string;
    value: QuestTaskType | QuestRewardType;
}

const rewardTypeOptions = [
    { label: "Orbs", value: QuestRewardType.VIRTUAL_CURRENCY },
    { label: "Nitro Codes", value: QuestRewardType.FRACTIONAL_PREMIUM },
    { label: "Reward Codes", value: QuestRewardType.REWARD_CODE },
    { label: "In Game Items", value: QuestRewardType.IN_GAME },
    { label: "Profile Collectibles", value: QuestRewardType.COLLECTIBLE },
] as const satisfies readonly QuestIncludedTypeOption[];

const taskTypeOptions = questTaskTypes.map(value => ({ label: questTaskLabels[value], value }));

const rewardTypeManaOptions = toManaOptions(rewardTypeOptions);
const taskTypeManaOptions = toManaOptions(taskTypeOptions);

const filterSettingKeys = ["disableQuestsEverything", "questButtonIncludedTypes"] as const;

export function QuestFiltersSetting(): JSX.Element {
    const filters = useQuestifySettings(filterSettingKeys);
    const disabled = filters.disableQuestsEverything;
    const includedTypes = filters.questButtonIncludedTypes;
    const selectedRewardTypes = rewardTypeOptions.filter(({ value }) => includedTypes[value]).map(({ value }) => String(value));
    const selectedQuestTypes = taskTypeOptions.filter(({ value }) => includedTypes[value]).map(({ value }) => String(value));

    function updateIncludedTypes(options: readonly QuestIncludedTypeOption[], value: string | string[] | null) {
        const selectedValues = new Set(Array.isArray(value) ? value : value ? [value] : []);
        const nextIncludedTypes = { ...getQuestifySettings().questButtonIncludedTypes };

        for (const option of options) {
            nextIncludedTypes[option.value] = selectedValues.has(String(option.value));
        }

        getQuestifySettings().questButtonIncludedTypes = nextIncludedTypes;
        validateIgnoredQuests();
    }

    return (
        <>
            <div className={q("settings-fields")}>
                <SettingsSelect
                    tooltip={settingTooltips.includedRewardTypes}
                    label="Reward types"
                    options={rewardTypeManaOptions}
                    value={selectedRewardTypes}
                    maxOptionsVisible={rewardTypeManaOptions.length}
                    selectionMode="multiple"
                    disabled={disabled}
                    onSelectionChange={value => updateIncludedTypes(rewardTypeOptions, value)}
                />
                <SettingsSelect
                    tooltip={settingTooltips.includedTaskTypes}
                    label="Quest types"
                    options={taskTypeManaOptions}
                    value={selectedQuestTypes}
                    maxOptionsVisible={taskTypeManaOptions.length}
                    selectionMode="multiple"
                    disabled={disabled}
                    onSelectionChange={value => updateIncludedTypes(taskTypeOptions, value)}
                />
            </div>
        </>
    );
}
