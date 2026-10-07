/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { findComponentByCodeLazy } from "@webpack";
import type { JSX, ReactNode } from "react";

import { getQuestifySettings, useQuestifySettings } from "../settings/access";
import { type QuestSubsort } from "../settings/def";
import { rerenderQuests } from "../settings/rerender";
import { settingTooltips } from "../settings/tooltips";
import { getValidQuestOrder } from "../utils/questTiles";
import { q } from "../utils/ui";
import { SettingsSection, SettingsSelect, SettingsSubtleSwitch, toManaOptions } from "./shared";

const DraggableItem = findComponentByCodeLazy<{
    index: number;
    itemId: string;
    itemType: string;
    listType: string;
    canDrag: boolean;
    disableDefaultPreview: boolean;
    onReorder: (from: number, to: number) => void;
    className: string;
    draggingClassName: string;
    dropBeforeClassName: string;
    dropAfterClassName: string;
    children: ReactNode;
}>("draggingClassName:", "dropBeforeClassName:");

const baseSubsortOptions = [
    { label: "Added (Newest)", value: "Recent DESC" },
    { label: "Added (Oldest)", value: "Recent ASC" },
] as const satisfies readonly { label: string, value: QuestSubsort; }[];

const expiringSubsortOptions = [
    ...baseSubsortOptions,
    { label: "Expiring (Soonest)", value: "Expiring ASC" },
    { label: "Expiring (Latest)", value: "Expiring DESC" },
] as const satisfies readonly { label: string, value: QuestSubsort; }[];

const expiredSubsortOptions = [
    ...baseSubsortOptions,
    { label: "Expired (Most Recent)", value: "Expiring DESC" },
    { label: "Expired (Least Recent)", value: "Expiring ASC" },
] as const satisfies readonly { label: string, value: QuestSubsort; }[];

const claimedSubsortOptions = [
    ...baseSubsortOptions,
    { label: "Claimed (Most Recent)", value: "Claimed DESC" },
    { label: "Claimed (Least Recent)", value: "Claimed ASC" },
] as const satisfies readonly { label: string, value: QuestSubsort; }[];

const expiringSubsortManaOptions = toManaOptions(expiringSubsortOptions);
const claimedSubsortManaOptions = toManaOptions(claimedSubsortOptions);
const expiredSubsortManaOptions = toManaOptions(expiredSubsortOptions);
const subsortFields = {
    UNCLAIMED: { key: "unclaimedSubsort", label: "Unclaimed", options: expiringSubsortManaOptions },
    CLAIMED: { key: "claimedSubsort", label: "Claimed", options: claimedSubsortManaOptions },
    IGNORED: { key: "ignoredSubsort", label: "Ignored", options: expiringSubsortManaOptions },
    EXPIRED: { key: "expiredSubsort", label: "Expired", options: expiredSubsortManaOptions },
} as const;

const sortingSettingKeys = [
    "disableQuestsEverything",
    "questOrder",
    "unclaimedSubsort",
    "claimedSubsort",
    "ignoredSubsort",
    "expiredSubsort",
] as const;

function QuestSortingSetting(): JSX.Element {
    const reorderQuests = useQuestifySettings(sortingSettingKeys);

    const disabled = reorderQuests.disableQuestsEverything;
    const questOrder = getValidQuestOrder(reorderQuests.questOrder);

    function moveQuestStatus(from: number, to: number): void {
        if (disabled || from === to || to < 0 || to >= questOrder.length) return;

        const nextOrder = [...questOrder];
        nextOrder.splice(to, 0, ...nextOrder.splice(from, 1));
        getQuestifySettings().questOrder = nextOrder;
        rerenderQuests();
    }

    function updateSubsort(key: "unclaimedSubsort" | "claimedSubsort" | "ignoredSubsort" | "expiredSubsort", value: string | string[] | null): void {
        if (typeof value !== "string") return;

        getQuestifySettings()[key] = value;
        rerenderQuests();
    }

    return (
        <ol className={q("sorting-order")}>
            {questOrder.map((status, index) => {
                const field = subsortFields[status];
                return (
                    <li key={status}>
                        <span className={q("sorting-position")} aria-hidden={true}>{index + 1}</span>
                        <DraggableItem
                            index={index}
                            itemId={status}
                            itemType="quest-status"
                            listType="questify-sorting"
                            canDrag={!disabled}
                            disableDefaultPreview={false}
                            onReorder={moveQuestStatus}
                            className={q("sorting-row")}
                            draggingClassName={q("sorting-dragging")}
                            dropBeforeClassName={q("sorting-drop-before")}
                            dropAfterClassName={q("sorting-drop-after")}
                        >
                            <Button
                                variant="none"
                                className={q("sorting-handle")}
                                disabled={disabled}
                                aria-label={`Reorder ${field.label}, position ${index + 1} of ${questOrder.length}. Drag or use Arrow Up and Arrow Down.`}
                                aria-keyshortcuts="ArrowUp ArrowDown"
                                onKeyDown={event => {
                                    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
                                    event.preventDefault();
                                    event.stopPropagation();
                                    moveQuestStatus(index, index + (event.key === "ArrowUp" ? -1 : 1));
                                }}
                            >
                                <span className={q("sorting-grip")} aria-hidden={true}>⠿</span>
                                {field.label}
                            </Button>
                            <SettingsSelect
                                tooltip={settingTooltips[field.key]}
                                label={`Sort ${field.label} Quests by`}
                                hideLabel={true}
                                options={field.options}
                                value={reorderQuests[field.key]}
                                disabled={disabled}
                                maxOptionsVisible={field.options.length}
                                onSelectionChange={value => updateSubsort(field.key, value)}
                            />
                        </DraggableItem>
                    </li>
                );
            })}
        </ol>
    );
}

const pageSettingKeys = [
    "disableQuestsEverything", "rememberQuestPageSort", "rememberQuestPageFilters"
] as const;

export function QuestPageSetting(): JSX.Element {
    const page = useQuestifySettings(pageSettingKeys);
    const disabled = page.disableQuestsEverything;

    return (
        <SettingsSection title="Sorting" description="Drag groups to set their order. Dropdowns sort Quests within each group. Used when Questify is selected on the Quests page.">
            <QuestSortingSetting />
            <div className={q("compact-switches")}>
                <SettingsSubtleSwitch
                    tooltip={settingTooltips.rememberQuestPageSort}
                    label="Remember the selected Quest page sort"
                    checked={page.rememberQuestPageSort}
                    disabled={disabled}
                    onChange={checked => { getQuestifySettings().rememberQuestPageSort = checked; }}
                />
                <SettingsSubtleSwitch
                    tooltip={settingTooltips.rememberQuestPageFilters}
                    label="Remember the selected Quest page filters"
                    checked={page.rememberQuestPageFilters}
                    disabled={disabled}
                    onChange={checked => { getQuestifySettings().rememberQuestPageFilters = checked; }}
                />
            </div>
        </SettingsSection>
    );
}
