/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { JSX } from "react";

import { enabledOnStartup } from "..";
import { getQuestifySettings, useQuestifySettings } from "../settings/access";
import { type QuestButtonAction, type QuestButtonDisplayMode, type QuestButtonIndicatorMode } from "../settings/def";
import { startAutoFetchingQuests } from "../settings/fetching";
import { canShowBadge, canShowButton, canShowPill } from "../utils/ui";
import { DummyQuestButton } from "./questButton";
import { type ManaSelectOption, SettingsCard, SettingsColorPicker, SettingsDescription, SettingsHeader, SettingsRow, SettingsRowItem, SettingsSelect, SettingsSubheader } from "./shared";

const questButtonDisplayOptions = [
    { label: "Always", value: "always" },
    { label: "Unclaimed", value: "unclaimed" },
    { label: "Never", value: "never" },
] as const satisfies readonly { label: string; value: QuestButtonDisplayMode; }[];

const questButtonIndicatorOptions = [
    { label: "Pill", value: "pill" },
    { label: "Badge", value: "badge" },
    { label: "Both", value: "both" },
    { label: "None", value: "none" },
] as const satisfies readonly { label: string; value: QuestButtonIndicatorMode; }[];

const questButtonClickOptions = [
    { label: "Open Quests", value: "open-quests" },
    { label: "Context Menu", value: "context-menu" },
    { label: "Plugin Settings", value: "plugin-settings" },
    { label: "Nothing", value: "nothing" },
] as const satisfies readonly { label: string; value: QuestButtonAction; }[];

function toManaOptions<T extends string | number>(options: readonly { label: string; value: T; }[]): ManaSelectOption[] {
    return options.map(({ label, value }) => ({
        id: String(value),
        label,
        value: String(value),
    }));
}

const questButtonDisplayManaOptions = toManaOptions(questButtonDisplayOptions);
const questButtonIndicatorManaOptions = toManaOptions(questButtonIndicatorOptions);
const questButtonClickManaOptions = toManaOptions(questButtonClickOptions);

export function QuestButtonSetting(): JSX.Element {
    const questButton = useQuestifySettings([
        "disableQuestsEverything",
        "questButtonDisplay",
        "questButtonIndicator",
        "questButtonBadgeCount",
        "questButtonBadgeColor",
        "questButtonLeftClickAction",
        "questButtonMiddleClickAction",
        "questButtonRightClickAction",
    ]);

    const disabled = questButton.disableQuestsEverything;

    function updateQuestButtonDisplay(value: string | string[] | null) {
        if (typeof value !== "string") return;

        getQuestifySettings().questButtonDisplay = value as QuestButtonDisplayMode;
        startAutoFetchingQuests(true);
    }

    function updateQuestButtonIndicator(value: string | string[] | null) {
        if (typeof value !== "string") return;

        getQuestifySettings().questButtonIndicator = value as QuestButtonIndicatorMode;
        startAutoFetchingQuests(true);
    }

    function updateQuestButtonAction(key: "questButtonLeftClickAction" | "questButtonMiddleClickAction" | "questButtonRightClickAction", value: string | string[] | null) {
        if (typeof value !== "string") return;

        getQuestifySettings()[key] = value as QuestButtonAction;
    }

    function updateBadgeColor(value: number | null) {
        getQuestifySettings().questButtonBadgeColor = value;
    }

    return (
        <SettingsCard>
            <SettingsRow>
                <SettingsRowItem>
                    <SettingsHeader> Quest Button </SettingsHeader>
                    <SettingsDescription> Show a Quest Button in the server list with an optional indicator for unclaimed and unignored Quests. </SettingsDescription>
                </SettingsRowItem>
                {enabledOnStartup && <SettingsRowItem width="content">
                    <DummyQuestButton
                        badgeColor={questButton.questButtonBadgeColor}
                        leftClickAction={questButton.questButtonLeftClickAction}
                        middleClickAction={questButton.questButtonMiddleClickAction}
                        rightClickAction={questButton.questButtonRightClickAction}
                        showBadge={canShowBadge(questButton.questButtonIndicator)}
                        showPill={canShowPill(questButton.questButtonIndicator)}
                        visible={canShowButton(questButton.questButtonDisplay)}
                    />
                </SettingsRowItem>}
            </SettingsRow>
            <SettingsSubheader className="no-top-margin"> Button Behavior </SettingsSubheader>
            <SettingsRow>
                <SettingsRowItem>
                    <SettingsSelect
                        label="Left Click Action:"
                        options={questButtonClickManaOptions}
                        value={questButton.questButtonLeftClickAction}
                        selectionMode="single"
                        disabled={disabled}
                        fullWidth={true}
                        onSelectionChange={value => updateQuestButtonAction("questButtonLeftClickAction", value)}
                    />
                </SettingsRowItem>
                <SettingsRowItem>
                    <SettingsSelect
                        label="Middle Click Action:"
                        options={questButtonClickManaOptions}
                        value={questButton.questButtonMiddleClickAction}
                        selectionMode="single"
                        disabled={disabled}
                        fullWidth={true}
                        onSelectionChange={value => updateQuestButtonAction("questButtonMiddleClickAction", value)}
                    />
                </SettingsRowItem>
                <SettingsRowItem>
                    <SettingsSelect
                        label="Right Click Action:"
                        options={questButtonClickManaOptions}
                        value={questButton.questButtonRightClickAction}
                        selectionMode="single"
                        disabled={disabled}
                        fullWidth={true}
                        onSelectionChange={value => updateQuestButtonAction("questButtonRightClickAction", value)}
                    />
                </SettingsRowItem>
            </SettingsRow>
            <SettingsRow>
                <SettingsRowItem>
                    <SettingsSelect
                        label="Button Visibility:"
                        options={questButtonDisplayManaOptions}
                        value={questButton.questButtonDisplay}
                        selectionMode="single"
                        disabled={disabled}
                        fullWidth={true}
                        onSelectionChange={updateQuestButtonDisplay}
                        tooltip={{
                            position: "top",
                            text: "Always shows the Quest Button whenever this feature is enabled."
                                + "\n\nUnclaimed only shows it while you have relevant unclaimed Quest rewards."
                                + "\n\nNever hides the Quest Button."
                        }}
                    />
                </SettingsRowItem>
                <SettingsRowItem>
                    <SettingsSelect
                        label="Unclaimed Indicator:"
                        options={questButtonIndicatorManaOptions}
                        value={questButton.questButtonIndicator}
                        selectionMode="single"
                        disabled={disabled}
                        fullWidth={true}
                        onSelectionChange={updateQuestButtonIndicator}
                        tooltip={{
                            position: "top",
                            text: "Pill shows Discord's unread-style marker beside the Quest Button."
                                + "\n\nBadge shows the number of relevant unclaimed Quest rewards."
                                + "\n\nBoth shows the pill and badge together."
                                + "\n\nNone hides unclaimed indicators."
                        }}
                    />
                </SettingsRowItem>
                <SettingsRowItem>
                    <SettingsColorPicker
                        label="Badge Color:"
                        className="quest-button-color-picker"
                        color={questButton.questButtonBadgeColor}
                        disabled={disabled}
                        onChange={updateBadgeColor}
                        showEyeDropper={true}
                    />
                </SettingsRowItem>
            </SettingsRow>
        </SettingsCard>
    );
}
