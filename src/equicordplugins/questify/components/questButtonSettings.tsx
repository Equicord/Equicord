/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { JSX } from "react";

import { getQuestifySettings, useQuestifySettings } from "../settings/access";
import { type QuestButtonAction, type QuestButtonDisplayMode, type QuestButtonIndicatorMode } from "../settings/def";
import { settingTooltips } from "../settings/tooltips";
import { enabledOnStartup } from "../state";
import { canShowBadge, canShowButton, canShowPill } from "../utils/ui";
import { DummyQuestButton } from "./questButton";
import { SettingsColorPicker, SettingsRow, SettingsRowItem, SettingsSection, SettingsSelect, toManaOptions } from "./shared";

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

const questButtonDisplayManaOptions = toManaOptions(questButtonDisplayOptions);
const questButtonIndicatorManaOptions = toManaOptions(questButtonIndicatorOptions);
const questButtonClickManaOptions = toManaOptions(questButtonClickOptions);

const buttonSettingKeys = [
    "disableQuestsEverything",
    "questButtonDisplay",
    "questButtonIndicator",
    "questButtonBadgeColor",
    "questButtonLeftClickAction",
    "questButtonMiddleClickAction",
    "questButtonRightClickAction",
] as const;

export function QuestButtonSetting(): JSX.Element {
    const questButton = useQuestifySettings(buttonSettingKeys);

    const disabled = questButton.disableQuestsEverything;
    function updateQuestButtonDisplay(value: string | string[] | null) {
        if (typeof value !== "string") return;

        getQuestifySettings().questButtonDisplay = value as QuestButtonDisplayMode;
    }

    function updateQuestButtonIndicator(value: string | string[] | null) {
        if (typeof value !== "string") return;

        getQuestifySettings().questButtonIndicator = value as QuestButtonIndicatorMode;
    }

    function updateQuestButtonAction(key: "questButtonLeftClickAction" | "questButtonMiddleClickAction" | "questButtonRightClickAction", value: string | string[] | null) {
        if (typeof value !== "string") return;

        getQuestifySettings()[key] = value as QuestButtonAction;
    }

    function updateBadgeColor(value: number | null) {
        getQuestifySettings().questButtonBadgeColor = value;
    }

    return (
        <SettingsSection
            title="Quest button"
            description="Adds a Quests button to the server list."
            trailing={enabledOnStartup && <DummyQuestButton
                badgeColor={questButton.questButtonBadgeColor}
                leftClickAction={questButton.questButtonLeftClickAction}
                middleClickAction={questButton.questButtonMiddleClickAction}
                rightClickAction={questButton.questButtonRightClickAction}
                showBadge={canShowBadge(questButton.questButtonIndicator)}
                showPill={canShowPill(questButton.questButtonIndicator)}
                visible={canShowButton(questButton.questButtonDisplay)}
            />}
        >
            <SettingsRow>
                <SettingsRowItem>
                    <SettingsSelect
                        tooltip={settingTooltips.questButtonDisplay}
                        label="Button Visibility"
                        options={questButtonDisplayManaOptions}
                        value={questButton.questButtonDisplay}
                        disabled={disabled}
                        onSelectionChange={updateQuestButtonDisplay}
                    />
                </SettingsRowItem>
                <SettingsRowItem>
                    <SettingsSelect
                        tooltip={settingTooltips.questButtonIndicator}
                        label="Unclaimed indicator"
                        options={questButtonIndicatorManaOptions}
                        value={questButton.questButtonIndicator}
                        disabled={disabled}
                        onSelectionChange={updateQuestButtonIndicator}
                    />
                </SettingsRowItem>
                <SettingsRowItem>
                    <SettingsColorPicker
                        label="Badge color"
                        labelClassName="quest-button-color-label"
                        className="quest-button-color-picker"
                        color={questButton.questButtonBadgeColor}
                        disabled={disabled || !canShowBadge(questButton.questButtonIndicator)}
                        onChange={updateBadgeColor}
                        showEyeDropper={true}
                    />
                </SettingsRowItem>
            </SettingsRow>

            <SettingsRow>
                <SettingsRowItem>
                    <SettingsSelect
                        label="Left Click Action"
                        options={questButtonClickManaOptions}
                        value={questButton.questButtonLeftClickAction}
                        disabled={disabled}
                        onSelectionChange={value => updateQuestButtonAction("questButtonLeftClickAction", value)}
                    />
                </SettingsRowItem>
                <SettingsRowItem>
                    <SettingsSelect
                        label="Middle Click Action"
                        options={questButtonClickManaOptions}
                        value={questButton.questButtonMiddleClickAction}
                        disabled={disabled}
                        onSelectionChange={value => updateQuestButtonAction("questButtonMiddleClickAction", value)}
                    />
                </SettingsRowItem>
                <SettingsRowItem>
                    <SettingsSelect
                        label="Right Click Action"
                        options={questButtonClickManaOptions}
                        value={questButton.questButtonRightClickAction}
                        disabled={disabled}
                        onSelectionChange={value => updateQuestButtonAction("questButtonRightClickAction", value)}
                    />
                </SettingsRowItem>
            </SettingsRow>
        </SettingsSection>
    );
}
