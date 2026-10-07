/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Alerts, TabBar, useState } from "@webpack/common";
import type { JSX } from "react";

import { getQuestifySettings, useQuestifySettings } from "../settings/access";
import { resetDangerousSettings } from "../settings/dangerous";
import { autoCompleteQuestTaskTypes, defaultAutoCompleteQuestTypes, isDesktopCompatible, questTaskLabels } from "../settings/def";
import { settingTooltips } from "../settings/tooltips";
import { q } from "../utils/ui";
import { QuestButtonSetting } from "./questButtonSettings";
import { QuestFiltersSetting } from "./questFiltersSetting";
import { QuestNotificationsSetting } from "./questNotificationsSetting";
import { QuestPageSetting } from "./questPageSetting";
import { QuestAppearanceSetting } from "./questTilesSetting";
import { ManaButton, type ManaSelectOption, SettingsParagraph, SettingsSection, SettingsSelect, SettingsSubtleSwitch } from "./shared";

type QuestDisableSettingKey =
    | "disableAccountPanelPromo"
    | "disableAccountPanelQuestProgress"
    | "disableFriendsListPromo"
    | "disableMembersListPromo"
    | "disableOrbsAndQuestsBadges"
    | "disableRelocationNotices"
    | "disableSponsoredBanner";

type QuestModifySettingKey =
    | "autoCompleteQuestsSimultaneously"
    | "resumeInterruptedQuests"
    | "completeVideoQuestsQuicker"
    | "preventVideoQuestsPausing"
    | "makeMobileVideoQuestsDesktopCompatible";

interface QuestDisableOption {
    key: QuestDisableSettingKey;
    label: string;
}

const disableFeatureOptions = [
    {
        key: "disableSponsoredBanner",
        label: "Sponsored Banner",
    },
    {
        key: "disableRelocationNotices",
        label: "Relocation Notices",
    },
    {
        key: "disableFriendsListPromo",
        label: "Friends List Promo",
    },
    {
        key: "disableMembersListPromo",
        label: "Members List Promo",
    },
    {
        key: "disableAccountPanelPromo",
        label: "Account Panel Promo",
    },
    {
        key: "disableAccountPanelQuestProgress",
        label: "Account Panel Progress",
    },
    {
        key: "disableOrbsAndQuestsBadges",
        label: "Quest & Orbs Badges",
    },
] as const satisfies readonly QuestDisableOption[];

const disabledFeatureChoices: ManaSelectOption[] = disableFeatureOptions.map(({ key, label }) => ({
    id: key,
    value: key,
    label,
}));

const autoCompleteQuestTypeManaOptions: ManaSelectOption[] = autoCompleteQuestTaskTypes.map(questType => ({
    id: String(questType),
    label: questTaskLabels[questType],
    value: String(questType),
    disabled: !isDesktopCompatible(questType),
}));

const completionOptions = [
    { id: "completeVideoQuestsQuicker", value: "completeVideoQuestsQuicker", label: "Accelerate Video Quest auto-completion" },
    { id: "preventVideoQuestsPausing", value: "preventVideoQuestsPausing", label: "Prevent Video Quests from pausing when losing focus" },
    { id: "makeMobileVideoQuestsDesktopCompatible", value: "makeMobileVideoQuestsDesktopCompatible", label: "Make some mobile-only Video Quests completable on desktop" },
    { id: "autoCompleteQuestsSimultaneously", value: "autoCompleteQuestsSimultaneously", label: "Auto-complete Quests simultaneously rather than sequentially" },
    { id: "resumeInterruptedQuests", value: "resumeInterruptedQuests", label: "Resume interrupted auto-completions after a reload or restart" },
] satisfies { id: string; value: QuestModifySettingKey; label: string; }[];

interface SettingsAllowDangerousButtonProps {
    allowed: boolean;
    disabled?: boolean;
    onClick?: (e: React.MouseEvent) => void;
}

function SettingsAllowDangerousButton({
    allowed,
    disabled,
    onClick,
}: SettingsAllowDangerousButtonProps): JSX.Element {
    return (
        <div className={q("settings-button", "allow-dangerous-button")}>
            <ManaButton
                text={allowed
                    ? "Reset and disallow changing dangerous settings..."
                    : "Allow changing dangerous settings..."}
                variant={allowed ? "critical-secondary" : "critical-primary"}
                fullWidth={true}
                disabled={disabled}
                onClick={onClick}
                size="sm"
            />
        </div>
    );
}

function confirmDangerousSettingChange(body: string, onConfirm: () => void) {
    Alerts.show({
        title: "Are you sure?",
        body,
        confirmText: "Continue",
        confirmVariant: "critical-primary",
        cancelText: "Cancel",
        onConfirm,
    });
}

const visibilitySettingKeys = [
    "disableQuestsEverything", "disableSponsoredBanner", "disableRelocationNotices",
    "disableFriendsListPromo", "disableMembersListPromo", "disableAccountPanelPromo",
    "disableAccountPanelQuestProgress", "disableOrbsAndQuestsBadges",
] as const;

function QuestVisibilitySetting(): JSX.Element {
    const visibility = useQuestifySettings(visibilitySettingKeys);
    const { disableQuestsEverything } = visibility;
    const selectedFeatures = disableFeatureOptions.filter(({ key }) => visibility[key]).map(({ key }) => key);

    function updateDisabledFeatures(value: string | string[] | null): void {
        const selected = new Set(Array.isArray(value) ? value : value ? [value] : []);
        for (const { key } of disableFeatureOptions) {
            getQuestifySettings()[key] = selected.has(key);
        }
    }

    function updateDisableEverything(checked: boolean) {
        function setDisableEverything() {
            getQuestifySettings().disableQuestsEverything = checked;
        }

        if (checked) {
            confirmDangerousSettingChange(
                "This will completely disable Quest functionality.",
                () => {
                    resetDangerousSettings();
                    setDisableEverything();
                }
            );
        } else {
            setDisableEverything();
        }
    }

    return (
        <>
            <SettingsSubtleSwitch
                checked={disableQuestsEverything}
                tooltip={settingTooltips.disableQuestsEverything}
                label="Completely disable Quest functionality"
                onChange={updateDisableEverything}
            />
            <SettingsSelect
                className="specific-features"
                tooltip={settingTooltips.disabledFeatures}
                label="Disable specific features"
                options={disabledFeatureChoices}
                value={selectedFeatures}
                selectionMode="multiple"
                maxOptionsVisible={disabledFeatureChoices.length}
                placeholder="None"
                disabled={disableQuestsEverything}
                onSelectionChange={updateDisabledFeatures}
            />
        </>
    );
}

function QuestGeneralSetting(): JSX.Element {
    return (
        <>
            <SettingsSection title="Disabled features" description="Disable Quests completely or hide specific promotions and badges.">
                <QuestVisibilitySetting />
            </SettingsSection>
            <SettingsSection title="Tracked Quests" description="Choose which Quests Questify counts and notifies you about.">
                <QuestFiltersSetting />
            </SettingsSection>
        </>
    );
}

function QuestStyleSetting(): JSX.Element {
    return (
        <>
            <QuestButtonSetting />
            <QuestAppearanceSetting />
        </>
    );
}

function QuestAdvancedSetting(): JSX.Element {
    return (
        <>
            <QuestPageSetting />
            <QuestCompletionSetting />
        </>
    );
}

const settingsTabs = {
    General: QuestGeneralSetting,
    Notifications: QuestNotificationsSetting,
    Appearance: QuestStyleSetting,
    Advanced: QuestAdvancedSetting,
};
const tabNames = Object.keys(settingsTabs);

export function QuestFeaturesSetting(): JSX.Element {
    const [tab, setTab] = useState<keyof typeof settingsTabs>("General");
    const Panel = settingsTabs[tab];

    return (
        <div className={q("settings")}>
            <TabBar type="top" look="brand" className={q("settings-tabs")} selectedItem={tab} onItemSelect={setTab}>
                {tabNames.map(name => <TabBar.Item key={name} id={name}>{name}</TabBar.Item>)}
            </TabBar>
            <div role="tabpanel" aria-label={tab}>
                <Panel />
            </div>
        </div>
    );
}

const completionSettingKeys = [
    "disableQuestsEverything", "resumeInterruptedQuests", "allowChangingDangerousSettings",
    "makeMobileVideoQuestsDesktopCompatible", "autoCompleteQuestsSimultaneously",
    "autoCompleteQuestTypes", "completeVideoQuestsQuicker", "preventVideoQuestsPausing",
] as const;

function QuestCompletionSetting(): JSX.Element {
    const questFeatures = useQuestifySettings(completionSettingKeys);
    const selectedAutoCompleteQuestTypeValues = autoCompleteQuestTaskTypes
        .filter(questType => isDesktopCompatible(questType) && questFeatures.autoCompleteQuestTypes[questType] === true)
        .map(String);

    function updateAutoCompleteQuestTypes(value: string | string[] | null) {
        const selectedValues = new Set(Array.isArray(value) ? value : value ? [value] : []);
        const nextAutoCompleteQuestTypes = { ...defaultAutoCompleteQuestTypes };

        for (const questType of autoCompleteQuestTaskTypes) {
            const nextValue = selectedValues.has(String(questType))
                && isDesktopCompatible(questType);

            nextAutoCompleteQuestTypes[questType] = nextValue;
        }

        getQuestifySettings().autoCompleteQuestTypes = nextAutoCompleteQuestTypes;
    }

    function updateDangerousAccess(checked: boolean) {
        function setDangerousAccess() {
            getQuestifySettings().allowChangingDangerousSettings = checked;
        }

        if (checked) {
            confirmDangerousSettingChange(
                "This will allow changing dangerous settings.",
                setDangerousAccess
            );
        } else {
            resetDangerousSettings();
            setDangerousAccess();
        }
    }

    return (
        <SettingsSection title="Quest completion" className={["completion-section", ...(questFeatures.disableQuestsEverything ? ["dimmed-settings-item"] : [])]}>
            <SettingsParagraph>
                Discord is known to punish users of scripts or plugins that modify the completion of Quests. Modifying the completion of Quests is against Discord's <a href="https://discord.com/safety/platform-manipulation-policy-explainer" target="_blank" rel="noreferrer">Terms of Service</a>.
            </SettingsParagraph>
            <SettingsParagraph>
                The punishment consists of a temporary or permanent loss of access to Quests and their rewards. <strong>The punishment also consists of an account standing violation which lasts 2 years per violation.</strong>
            </SettingsParagraph>
            <SettingsParagraph>
                Due to the various methods Discord uses to track users, there's no way to realistically evade detection. If you proceed, understand that Discord likely will detect your use at some point.
            </SettingsParagraph>
            <SettingsParagraph>
                Use the following toggle to access potentially dangerous settings at your own risk.
            </SettingsParagraph>
            <SettingsAllowDangerousButton
                allowed={questFeatures.allowChangingDangerousSettings}
                disabled={questFeatures.disableQuestsEverything}
                onClick={() => updateDangerousAccess(!questFeatures.allowChangingDangerousSettings)}
            />
            {questFeatures.allowChangingDangerousSettings && <div className={q("completion-controls", "compact-switches")}>
                {completionOptions.map(({ value, label }) => (
                    <SettingsSubtleSwitch
                        key={value}
                        tooltip={settingTooltips[value]}
                        label={`${label}:`}
                        checked={questFeatures[value]}
                        disabled={questFeatures.disableQuestsEverything}
                        onChange={checked => { getQuestifySettings()[value] = checked; }}
                    />
                ))}
                <SettingsSelect
                    tooltip={settingTooltips.autoCompleteQuestTypes}
                    formatOption={option => ({
                        ...option,
                        description: option.disabled ? "Requires the official desktop app" : undefined,
                    })}
                    wideTooltip={true}
                    label="Auto-complete specific Quest types:"
                    options={autoCompleteQuestTypeManaOptions}
                    value={selectedAutoCompleteQuestTypeValues}
                    maxOptionsVisible={7}
                    selectionMode="multiple"
                    disabled={questFeatures.disableQuestsEverything}
                    onSelectionChange={updateAutoCompleteQuestTypes}
                />
            </div>}
        </SettingsSection>
    );
}
