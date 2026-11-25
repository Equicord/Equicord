/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { QuestRewardType, QuestTaskType } from "@vencord/discord-types/enums";
import { useCallback, useMemo } from "@webpack/common";

import { allQuestRewardTypes, getQuestCombinationKey, getTaskFirstCombinationKey, parseQuestCombinationKey, type QuestCombinationKey, questRewardTypeLabels, questTaskTypeLabels } from "../settings/def";
import type { ManaComboSelectOption, ManaComboSelectProps } from "./shared";

interface CombinationOption extends ManaComboSelectOption {
    optionKind: "reward-header" | "reward-pair" | "task-header" | "task-pair";
    primaryLabel: string;
    rewardType?: QuestRewardType;
    taskType?: QuestTaskType;
}

export interface UseQuestCombinationSelectOptions {
    value: readonly QuestCombinationKey[];
    onChange: (combinations: QuestCombinationKey[]) => void;
    taskTypes: readonly QuestTaskType[];
}

const REWARD_PREFIX = "reward:";
const TASK_PREFIX = "task:";

function orderCombinationKeys(keySet: ReadonlySet<QuestCombinationKey>, taskTypes: readonly QuestTaskType[]): QuestCombinationKey[] {
    const ordered: QuestCombinationKey[] = [];

    for (const rewardType of allQuestRewardTypes) {
        for (const taskType of taskTypes) {
            const key = getQuestCombinationKey(rewardType, taskType);

            if (keySet.has(key)) {
                ordered.push(key);
            }
        }
    }

    for (const taskType of taskTypes) {
        for (const rewardType of allQuestRewardTypes) {
            const key = getTaskFirstCombinationKey(taskType, rewardType);

            if (keySet.has(key)) {
                ordered.push(key);
            }
        }
    }

    return ordered;
}

function expandOptionValueToKeys(
    token: string,
    taskTypes: readonly QuestTaskType[],
    taskTypeSet: ReadonlySet<QuestTaskType>,
): QuestCombinationKey[] {
    if (token.startsWith(REWARD_PREFIX)) {
        const rewardType = Number(token.slice(REWARD_PREFIX.length)) as QuestRewardType;

        return allQuestRewardTypes.includes(rewardType)
            ? taskTypes.map(taskType => getQuestCombinationKey(rewardType, taskType))
            : [];
    }

    if (token.startsWith(TASK_PREFIX)) {
        const taskType = token.slice(TASK_PREFIX.length) as QuestTaskType;

        return taskTypeSet.has(taskType)
            ? allQuestRewardTypes.map(rewardType => getTaskFirstCombinationKey(taskType, rewardType))
            : [];
    }

    const parsed = parseQuestCombinationKey(token);

    return parsed && taskTypeSet.has(parsed.taskType) ? [token as QuestCombinationKey] : [];
}

function matchQuestCombinationOptions(options: ManaComboSelectOption[], rawQuery: string): ManaComboSelectOption[] {
    const tokens = rawQuery.trim().toLowerCase().split(/[\s/]+/).filter(Boolean);

    if (tokens.length === 0) {
        return options;
    }

    const comboOptions = options as CombinationOption[];
    const matchesTokens = (text: string) => tokens.every(token => text.toLowerCase().includes(token));
    const results: CombinationOption[] = [];
    const addedIds = new Set<string>();

    function pushOption(option: CombinationOption): void {
        if (addedIds.has(option.id)) {
            return;
        }

        addedIds.add(option.id);
        results.push(option);
    }

    for (const option of comboOptions) {
        if (option.optionKind === "reward-header" && matchesTokens(option.label)) {
            pushOption(option);

            for (const child of comboOptions) {
                if (child.optionKind === "reward-pair" && child.rewardType === option.rewardType) {
                    pushOption(child);
                }
            }
        }
    }

    for (const option of comboOptions) {
        if (option.optionKind === "task-header" && matchesTokens(option.label)) {
            pushOption(option);

            for (const child of comboOptions) {
                if (child.optionKind === "task-pair" && child.taskType === option.taskType) {
                    pushOption(child);
                }
            }
        }
    }

    const firstToken = tokens[0];
    const matchingPairs = comboOptions.filter(option =>
        (option.optionKind === "reward-pair" || option.optionKind === "task-pair")
        && !addedIds.has(option.id)
        && matchesTokens(option.label)
    );

    for (const option of matchingPairs) {
        if (option.primaryLabel.toLowerCase().includes(firstToken)) {
            pushOption(option);
        }
    }

    for (const option of matchingPairs) {
        pushOption(option);
    }

    return results;
}

export function useQuestCombinationSelectProps({
    value,
    onChange,
    taskTypes,
}: UseQuestCombinationSelectOptions): Pick<
    ManaComboSelectProps,
    "clearable" | "closeOnSelect" | "customMatchSorter" | "onSelectionChange" | "options" | "selectionMode" | "value" | "wrapTags"
> {
    const taskTypeSet = useMemo(() => new Set<QuestTaskType>(taskTypes), [taskTypes]);
    const valueKey = Array.isArray(value) ? value.join("|") : "";

    const { selectedKeySet, preservedHiddenKeys } = useMemo(() => {
        const nextSet = new Set<QuestCombinationKey>();
        const hidden: QuestCombinationKey[] = [];
        const seenHidden = new Set<QuestCombinationKey>();

        if (valueKey) {
            for (const rawKey of valueKey.split("|")) {
                const key = rawKey as QuestCombinationKey;
                const parsed = parseQuestCombinationKey(key);

                if (!parsed) {
                    continue;
                }

                if (taskTypeSet.has(parsed.taskType)) {
                    nextSet.add(key);
                } else if (!seenHidden.has(key)) {
                    seenHidden.add(key);
                    hidden.push(key);
                }
            }
        }

        return { selectedKeySet: nextSet, preservedHiddenKeys: hidden };
    }, [valueKey, taskTypeSet]);

    const displayValues = useMemo(() => {
        const values: string[] = [];

        if (taskTypes.length > 0) {
            for (const rewardType of allQuestRewardTypes) {
                const rewardKeys = taskTypes.map(taskType => getQuestCombinationKey(rewardType, taskType));

                if (rewardKeys.every(key => selectedKeySet.has(key))) {
                    values.push(`${REWARD_PREFIX}${rewardType}`);
                } else {
                    for (const key of rewardKeys) {
                        if (selectedKeySet.has(key)) {
                            values.push(key);
                        }
                    }
                }
            }
        }

        for (const taskType of taskTypes) {
            const taskKeys = allQuestRewardTypes.map(rewardType => getTaskFirstCombinationKey(taskType, rewardType));

            if (taskKeys.every(key => selectedKeySet.has(key))) {
                values.push(`${TASK_PREFIX}${taskType}`);
            } else {
                for (const key of taskKeys) {
                    if (selectedKeySet.has(key)) {
                        values.push(key);
                    }
                }
            }
        }

        return values;
    }, [taskTypes, selectedKeySet]);

    const options = useMemo<CombinationOption[]>(() => {
        const nextOptions: CombinationOption[] = [];

        for (const rewardType of allQuestRewardTypes) {
            const rewardLabel = questRewardTypeLabels[rewardType];

            nextOptions.push({
                id: `${REWARD_PREFIX}${rewardType}`,
                value: `${REWARD_PREFIX}${rewardType}`,
                label: rewardLabel,
                primaryLabel: rewardLabel,
                optionKind: "reward-header",
                rewardType,
            });

            for (const taskType of taskTypes) {
                const key = getQuestCombinationKey(rewardType, taskType);

                nextOptions.push({
                    id: key,
                    value: key,
                    label: `${rewardLabel} / ${questTaskTypeLabels[taskType]}`,
                    primaryLabel: rewardLabel,
                    optionKind: "reward-pair",
                    rewardType,
                    taskType,
                });
            }
        }

        for (const taskType of taskTypes) {
            const taskLabel = questTaskTypeLabels[taskType];

            nextOptions.push({
                id: `${TASK_PREFIX}${taskType}`,
                value: `${TASK_PREFIX}${taskType}`,
                label: taskLabel,
                primaryLabel: taskLabel,
                optionKind: "task-header",
                taskType,
            });

            for (const rewardType of allQuestRewardTypes) {
                const key = getTaskFirstCombinationKey(taskType, rewardType);

                nextOptions.push({
                    id: key,
                    value: key,
                    label: `${taskLabel} / ${questRewardTypeLabels[rewardType]}`,
                    primaryLabel: taskLabel,
                    optionKind: "task-pair",
                    rewardType,
                    taskType,
                });
            }
        }

        return nextOptions;
    }, [taskTypes]);

    const handleSelectionChange = useCallback((rawNext: string | string[] | null) => {
        const nextValues = Array.isArray(rawNext) ? rawNext : rawNext ? [rawNext] : [];

        if (nextValues.length === 0) {
            onChange([...preservedHiddenKeys]);
            return;
        }

        const prevSet = new Set(displayValues);
        const nextSet = new Set(nextValues);
        const added = nextValues.filter(token => !prevSet.has(token));
        const removed = displayValues.filter(token => !nextSet.has(token));
        const nextKeys = new Set(selectedKeySet);

        if (added.length === 1 && removed.length === 0) {
            const targetKeys = expandOptionValueToKeys(added[0], taskTypes, taskTypeSet);

            if (targetKeys.length > 0) {
                if (targetKeys.every(key => nextKeys.has(key))) {
                    targetKeys.forEach(key => nextKeys.delete(key));
                } else {
                    targetKeys.forEach(key => nextKeys.add(key));
                }
            }
        } else if (removed.length === 1 && added.length === 0) {
            expandOptionValueToKeys(removed[0], taskTypes, taskTypeSet).forEach(key => nextKeys.delete(key));
        } else {
            nextKeys.clear();

            for (const token of nextValues) {
                expandOptionValueToKeys(token, taskTypes, taskTypeSet).forEach(key => nextKeys.add(key));
            }
        }

        onChange([...orderCombinationKeys(nextKeys, taskTypes), ...preservedHiddenKeys]);
    }, [displayValues, onChange, preservedHiddenKeys, selectedKeySet, taskTypes, taskTypeSet]);

    return {
        options,
        value: displayValues,
        onSelectionChange: handleSelectionChange,
        customMatchSorter: matchQuestCombinationOptions,
        selectionMode: "multiple",
        clearable: true,
        wrapTags: true,
        closeOnSelect: false,
    };
}
