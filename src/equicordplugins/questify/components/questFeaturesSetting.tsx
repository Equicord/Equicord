/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useCallback, useMemo } from "@webpack/common";
import type { JSX } from "react";

import { getQuestifySettings, useQuestifySettings } from "../settings/access";
import { resetDangerousSettings } from "../settings/dangerous";
import { autoCompleteQuestTaskTypes, isAutoCompleteCompatible, type QuestCombinationKey } from "../settings/def";
import { validateIgnoredQuests } from "../settings/ignoredQuests";
import { flushPendingAutoCompleteStagger } from "../utils/completion";
import { Alerts, q } from "../utils/ui";
import { useQuestCombinationSelectProps } from "./questCombinationSelect";
import { ManaButton, type ManaSelectOption, SettingsCard, SettingsComboSelect, SettingsDescription, SettingsHeader, SettingsNotice, SettingsParagraph, SettingsSelect, SettingsSubheader, SettingsSubtleSwitch } from "./shared";

type QuestDisableSettingKey =
    | "disableAccountPanelPromo"
    | "disableAccountPanelQuestProgress"
    | "disableFriendsListPromo"
    | "disableMembersListPromo"
    | "disableOrbsAndQuestsBadges"
    | "disableSponsoredBanner";

type QuestModifySettingKey =
    | "autoEnrollQuests"
    | "autoCompleteQuests"
    | "staggerSequentialAutoCompletes"
    | "autoCompleteQuestsSimultaneously"
    | "resumeInterruptedQuests"
    | "completeVideoQuestsQuicker"
    | "preventVideoQuestsPausing"
    | "hideNonAutoCompletableQuests"
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

const disableManaOptions: ManaSelectOption[] = disableFeatureOptions.map(({ key, label }) => ({
    id: key,
    label,
    value: key,
}));

export function QuestFeaturesSetting(): JSX.Element {
    const questFeatures = useQuestifySettings([
        "disableQuestsEverything",
        "disableSponsoredBanner",
        "disableFriendsListPromo",
        "disableMembersListPromo",
        "disableAccountPanelPromo",
        "disableAccountPanelQuestProgress",
        "disableOrbsAndQuestsBadges",
        "resumeInterruptedQuests",
        "allowChangingDangerousSettings",
        "makeMobileVideoQuestsDesktopCompatible",
        "usedKonamiCode",
        "autoEnrollQuests",
        "autoCompleteQuests",
        "staggerSequentialAutoCompletes",
        "autoCompleteQuestsSimultaneously",
        "autoCompleteQuestCombinations",
        "completeVideoQuestsQuicker",
        "preventVideoQuestsPausing",
        "hideNonAutoCompletableQuests",
    ]);

    const compatibleAutoCompleteTaskTypes = useMemo(() => autoCompleteQuestTaskTypes.filter(isAutoCompleteCompatible), []);

    const selectedDisableValues = disableFeatureOptions
        .filter(({ key }) => questFeatures[key])
        .map(({ key }) => key);

    function updateDisableValue(value: string | string[] | null) {
        const selectedKeys = new Set(Array.isArray(value) ? value : value ? [value] : []);

        for (const { key } of disableFeatureOptions) {
            getQuestifySettings()[key] = selectedKeys.has(key);
        }
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

    const updateAutoCompleteQuestCombinations = useCallback((combinations: QuestCombinationKey[]) => {
        getQuestifySettings().autoCompleteQuestCombinations = combinations;
        validateIgnoredQuests();
    }, []);

    const autoCompleteComboProps = useQuestCombinationSelectProps({ value: questFeatures.autoCompleteQuestCombinations, onChange: updateAutoCompleteQuestCombinations, taskTypes: compatibleAutoCompleteTaskTypes });

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

    function updateModifyValue(key: QuestModifySettingKey, checked: boolean) {
        getQuestifySettings()[key] = checked;

        if (key === "hideNonAutoCompletableQuests" || key === "makeMobileVideoQuestsDesktopCompatible") {
            validateIgnoredQuests();
        } else if (key === "staggerSequentialAutoCompletes" && !checked) {
            flushPendingAutoCompleteStagger();
        }
    }

    return (
        <SettingsCard>
            <SettingsHeader> Quest Features </SettingsHeader>
            <SettingsDescription> Modify how Quests behave to enhance or remove functionality. </SettingsDescription>
            <SettingsSubheader> Disable Features </SettingsSubheader>
            <SettingsSubtleSwitch
                checked={questFeatures.disableQuestsEverything}
                label="Completely disable Quest functionality:"
                onChange={updateDisableEverything}
                bottomSpacing="10"
                tooltip={{
                    position: "top",
                    text: "This will disable all plugin enhancements, hide the Quests page and Quest elements across Discord, and prevent Discord from fetching Quest data. This will not affect the shop as Orbs are too intrinsically tied to it as a secondary currency."
                }}
            />
            <SettingsSelect
                label="Disable specific features:"
                wrapTags={true}
                options={disableManaOptions}
                value={selectedDisableValues}
                closeOnSelect={false}
                maxOptionsVisible={7}
                selectionMode="multiple"
                disabled={questFeatures.disableQuestsEverything}
                onSelectionChange={updateDisableValue}
                tooltip={{
                    position: "top",
                    text: "Sponsored Banner is a paid-for Quest banner at the top of the Quests page."
                        + "\n\nFriends List Promo is a card that displays on the \"Active Now\" section of your Friends List while a user you share a server with is playing a game with an active Quest."
                        + "\n\nMembers List Promo is an icon that displays on members in a server's Members List while they are playing a game with an active Quest."
                        + "\n\nAccount Panel Promo is a paid-for Quest promotion that appears above your user account panel."
                        + "\n\nAccount Panel Progress is the active or completed Quest progress shown above your user account panel."
                        + "\n\nQuest & Orbs Badges are badges on user profiles for when someone has completed at least one Quest or bought the Orbs badge respectively."
                }}
            />
            <SettingsSubheader> Modify Features </SettingsSubheader>
            <SettingsNotice className={["notice-card-red", questFeatures.disableQuestsEverything ? "dimmed-settings-item" : undefined, questFeatures.allowChangingDangerousSettings ? undefined : "notice-card-solo", "no-bottom-margin"].filter(c => c !== undefined)}>
                <SettingsParagraph>
                    Discord is known to punish users of scripts or plugins that modify the completion of Quests. Modifying the completion of Quests is against Discord's <a href="https://discord.com/safety/platform-manipulation-policy-explainer" target="_blank" rel="noreferrer">Terms of Service</a>.
                </SettingsParagraph>
                <br />
                <SettingsParagraph>
                    The punishment consists of a temporary or permanent loss of access to Quests and their rewards. <strong>The punishment also consists of an account standing violation which lasts 2 years per violation.</strong>
                </SettingsParagraph>
                <br />
                <SettingsParagraph>
                    Due to the various methods Discord uses to track users, there's no way to realistically evade detection. If you proceed, understand that Discord likely will detect your use at some point.
                </SettingsParagraph>
                <br />
                <SettingsParagraph>
                    Use the following toggle to access potentially dangerous settings at your own risk.
                </SettingsParagraph>
                <div className={q("settings-button", "allow-dangerous-button")}>
                    <ManaButton
                        text={questFeatures.allowChangingDangerousSettings
                            ? "Reset and disallow changing dangerous settings..."
                            : "Allow changing dangerous settings..."}
                        variant={questFeatures.allowChangingDangerousSettings ? "critical-secondary" : "critical-primary"}
                        fullWidth={true}
                        disabled={questFeatures.disableQuestsEverything}
                        onClick={() => updateDangerousAccess(!questFeatures.allowChangingDangerousSettings)}
                        size="sm"
                    />
                </div>
                <div style={{ display: questFeatures.allowChangingDangerousSettings ? undefined : "none" }}>
                    <SettingsSubtleSwitch
                        disabled={questFeatures.disableQuestsEverything || !questFeatures.allowChangingDangerousSettings}
                        checked={questFeatures.hideNonAutoCompletableQuests}
                        label="Hide Non Auto-Completable Quests:"
                        onChange={checked => updateModifyValue("hideNonAutoCompletableQuests", checked)}
                        topSpacing="10"
                        bottomSpacing="5"
                        tooltip={{
                            position: "top",
                            text: "Hide incomplete Quests with an unclaimed or ignored status when no reward and task combination is supported on this platform and enabled in the auto-complete dropdown. Claimed, expired, completed, queued, auto-completing, and in-progress Quests are exempt. Use the Status Order Hidden options to hide those Quests."
                        }}
                    />
                    <SettingsSubtleSwitch
                        disabled={questFeatures.disableQuestsEverything || !questFeatures.allowChangingDangerousSettings}
                        checked={questFeatures.completeVideoQuestsQuicker}
                        label="Accelerate Video Quest auto-completion:"
                        onChange={checked => updateModifyValue("completeVideoQuestsQuicker", checked)}
                        bottomSpacing="5"
                        tooltip={{
                            position: "top",
                            text: "Discord allows Video Quests to be completed once 24 seconds less than the duration of the video has passed since you enrolled into the Quest."
                                + "\n\nThis means that if a Video Quest is 24 seconds or less, or if you enroll in a Video Quest and return later to complete it, it can be completed immediately."
                                + "\n\nThis setting will only apply to auto-completing Video Quests and relies on the auto-complete setting below. Manually completing Video Quests will still require waiting the full duration and is not dependent on enrollment time."
                        }}
                    />
                    <SettingsSubtleSwitch
                        disabled={questFeatures.disableQuestsEverything || !questFeatures.allowChangingDangerousSettings}
                        checked={questFeatures.preventVideoQuestsPausing}
                        label="Prevent Video Quests from pausing when losing focus:"
                        onChange={checked => updateModifyValue("preventVideoQuestsPausing", checked)}
                        bottomSpacing="5"
                        tooltip={{
                            position: "top",
                            text: "Discord forces you to be tabbed into the client for Video Quests to play their video."
                                + "\n\nThis setting prevents the video from pausing and allows completion to progress as normal."
                                + "\n\nThis setting applies only to manually completing Video Quests."
                        }}
                    />
                    <SettingsSubtleSwitch
                        disabled={questFeatures.disableQuestsEverything || !questFeatures.allowChangingDangerousSettings}
                        checked={questFeatures.makeMobileVideoQuestsDesktopCompatible}
                        label="Make some mobile-only Video Quests completable on desktop:"
                        onChange={checked => updateModifyValue("makeMobileVideoQuestsDesktopCompatible", checked)}
                        bottomSpacing="5"
                        tooltip={{
                            position: "top",
                            text: "Some mobile-only Video Quests can be enrolled in on desktop, but still must be completed on mobile. This setting will allow those to be completed on desktop."
                                + "\n\nSome mobile-only Video Quests are only enrollable on mobile. For this setting to affect those, you must enroll in those Quests on your mobile device before returning to desktop and refreshing your Quests."
                                + "\n\nThis setting, when enabled independently, applies only to manually completing Video Quests. Auto-completing mobile Video Quests from desktop relies on the auto-complete setting below, and will implicitly enable this setting as well."
                        }}
                    />
                    <SettingsSubtleSwitch
                        disabled={questFeatures.disableQuestsEverything || !questFeatures.allowChangingDangerousSettings}
                        checked={questFeatures.staggerSequentialAutoCompletes}
                        label="Stagger sequentially auto-completing Quests with 5s-3m delays:"
                        onChange={checked => updateModifyValue("staggerSequentialAutoCompletes", checked)}
                        bottomSpacing="5"
                        tooltip={{
                            position: "top",
                            text: "Waits a random delay between 5 seconds and 3 minutes after a Quest finishes before starting the next queued Quest."
                                + "\n\nThis setting applies only to sequential auto-completion and has no effect when simultaneous completion is enabled below."
                        }}
                    />
                    <SettingsSubtleSwitch
                        disabled={questFeatures.disableQuestsEverything || !questFeatures.allowChangingDangerousSettings}
                        checked={questFeatures.autoCompleteQuestsSimultaneously}
                        label="Simultaneously auto-complete Quests rather than sequentially:"
                        onChange={checked => updateModifyValue("autoCompleteQuestsSimultaneously", checked)}
                        bottomSpacing="5"
                        tooltip={{
                            position: "top",
                            text: "By default, attempting to auto-complete multiple Quests will queue them to be completed in order."
                                + "\n\nThis setting will alternatively allow all auto-complete Quests to run at the same time."
                                + "\n\nThis setting will only apply to auto-completing Quests and relies on the auto-complete setting below."
                        }}
                    />
                    <SettingsSubtleSwitch
                        disabled={questFeatures.disableQuestsEverything || !questFeatures.allowChangingDangerousSettings}
                        checked={questFeatures.resumeInterruptedQuests}
                        label="Resume interrupted auto-completions after a reload or restart:"
                        onChange={checked => updateModifyValue("resumeInterruptedQuests", checked)}
                        bottomSpacing="5"
                        tooltip={{
                            position: "top",
                            text: "This setting will automatically resume any interrupted auto-completions caused by reloads or restarts, including requeuing Quests which had yet to start auto-completing but had been queued."
                        }}
                    />
                    {questFeatures.usedKonamiCode === true && (
                        <>
                            <SettingsSubtleSwitch
                                disabled={questFeatures.disableQuestsEverything || !questFeatures.allowChangingDangerousSettings}
                                checked={questFeatures.autoCompleteQuests}
                                label="Automatically process compatible Quests for auto-completion:"
                                onChange={checked => updateModifyValue("autoCompleteQuests", checked)}
                                bottomSpacing="5"
                                tooltip={{
                                    position: "top",
                                    text: "Complete eligible, visible, unclaimed, unignored, and unexpired Quests that are detected while Discord is running. Only supported reward and task combinations enabled below are included."
                                        + "\n\nAutomatically enrolls in compatible Quests before queuing them for auto-completion. Waits for known rate-limit cooldowns. Stops on unknown errors, rate limits without a retry delay, or repeated enrollment failures."
                                }}
                            />
                            <SettingsSubtleSwitch
                                disabled={questFeatures.disableQuestsEverything || !questFeatures.allowChangingDangerousSettings}
                                checked={questFeatures.autoEnrollQuests}
                                label="Automatically enroll in compatible Quests."
                                onChange={checked => updateModifyValue("autoEnrollQuests", checked)}
                                bottomSpacing="5"
                                tooltip={{
                                    position: "top",
                                    text: "Enroll in eligible, visible, unclaimed, unignored, and unexpired Quests that are detected while Discord is running."
                                        + "\n\nEnrolls in Quests without queuing them for auto-completion. Waits for known rate-limit cooldowns. Stops on unknown errors, rate limits without a retry delay, or repeated enrollment failures."
                                }}
                            />
                        </>
                    )}
                    <SettingsComboSelect
                        label="Automatically complete Quests with these reward and task combinations:"
                        maxOptionsVisible={7}
                        placeholder="Search reward and task combinations..."
                        disabled={questFeatures.disableQuestsEverything || !questFeatures.allowChangingDangerousSettings}
                        {...autoCompleteComboProps}
                        tooltip={{
                            position: "top",
                            wider: true,
                            text: "Watch Video on Mobile Quests will only work on mobile Quests which are enrollable on desktop. If a Quest is locked to enrollment on mobile, you must first enroll in it on your mobile device before returning to desktop and refreshing your Quests."
                                + "\n\nAll video related Quests usually send a stack trace with the progress reports. This means Discord would know exactly which functions were called, and can therefore verify that their own functions initiated the progress. Questify erases this stack trace, but the absence of it will be just as telling as its presence."
                                + "\n\nPlay on Desktop, Play on PlayStation, Play on Xbox, Play Activity, and Achievement in Activity Quests are only available on official desktop clients due to a limitation imposed by Discord. 3rd party clients such as web extensions, Vesktop, Equibop, and others, do not support auto-completing these Quest types."
                                + "\n\nAll game related Quests usually send a game fingerprint with the heartbeat reports. This means Discord can use data from tens of thousands of users to determine whether other users are likely using a real game or are emulating the executable. There is no reasonable method to spoof this value, so Questify leaves it blank, but the absence of it will be just as telling as poorly spoofing the value."
                                + "\n\nSelected reward and task combinations apply to both manually queued and automatically started Quests. Auto-completion starts from Quest buttons on the Quests page or automatic processing. Quests are completed in the order they were queued, unless simultaneous completion is enabled above."
                                + "\n\nAuto-completing Quests is the riskiest dangerous setting available. Enable it at your own risk."
                        }}
                    />
                </div>
            </SettingsNotice>
        </SettingsCard>
    );
}
