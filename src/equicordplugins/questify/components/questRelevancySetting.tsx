/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useCallback, useEffect, useRef, useState } from "@webpack/common";
import type { JSX } from "react";

import { getQuestifySettings, useQuestifySettings } from "../settings/access";
import { allQuestTaskTypes, type QuestCombinationKey } from "../settings/def";
import { validateIgnoredQuests } from "../settings/ignoredQuests";
import { useQuestCombinationSelectProps } from "./questCombinationSelect";
import { SettingsCard, SettingsComboSelect, SettingsDescription, SettingsHeader, SettingsSubheader, SettingsTextInput } from "./shared";

const TERMS_DEBOUNCE_MS = 400;
const TERMS_TOOLTIP_TEXT = "Separate terms with commas. Matching is case-insensitive."
    + "\n\nOptional strict prefixes narrow a term to one field:"
    + "\nname: or quest: matches Quest name."
    + "\ngame: or title: matches game title."
    + "\npub: or publisher: matches game publisher."
    + "\n\nTerms without a matching prefix check all three fields.";

export function QuestRelevancySetting(): JSX.Element {
    const questRelevancy = useQuestifySettings([
        "disableQuestsEverything",
        "preventNotificationCombinations",
        "preventNotificationTerms",
        "hiddenQuestCombinations",
        "hiddenQuestTerms",
    ]);

    const disabled = questRelevancy.disableQuestsEverything;
    const [preventTermsInput, setPreventTermsInput] = useState(questRelevancy.preventNotificationTerms);
    const [hiddenTermsInput, setHiddenTermsInput] = useState(questRelevancy.hiddenQuestTerms);
    const latestPreventTerms = useRef(preventTermsInput);
    const latestHiddenTerms = useRef(hiddenTermsInput);
    const lastCommittedPreventTerms = useRef(questRelevancy.preventNotificationTerms);
    const lastCommittedHiddenTerms = useRef(questRelevancy.hiddenQuestTerms);

    latestPreventTerms.current = preventTermsInput;
    latestHiddenTerms.current = hiddenTermsInput;

    useEffect(() => {
        if (questRelevancy.preventNotificationTerms !== lastCommittedPreventTerms.current) {
            lastCommittedPreventTerms.current = questRelevancy.preventNotificationTerms;
            setPreventTermsInput(questRelevancy.preventNotificationTerms);
        }
    }, [questRelevancy.preventNotificationTerms]);

    useEffect(() => {
        if (questRelevancy.hiddenQuestTerms !== lastCommittedHiddenTerms.current) {
            lastCommittedHiddenTerms.current = questRelevancy.hiddenQuestTerms;
            setHiddenTermsInput(questRelevancy.hiddenQuestTerms);
        }
    }, [questRelevancy.hiddenQuestTerms]);

    const commitPreventNotificationTerms = useCallback((value: string) => {
        lastCommittedPreventTerms.current = value;

        if (getQuestifySettings().preventNotificationTerms === value) {
            return;
        }

        getQuestifySettings().preventNotificationTerms = value;
        validateIgnoredQuests();
    }, []);

    const commitHiddenQuestTerms = useCallback((value: string) => {
        lastCommittedHiddenTerms.current = value;

        if (getQuestifySettings().hiddenQuestTerms === value) {
            return;
        }

        getQuestifySettings().hiddenQuestTerms = value;
        validateIgnoredQuests();
    }, []);

    useEffect(() => {
        if (preventTermsInput === questRelevancy.preventNotificationTerms) {
            return;
        }

        const timeout = setTimeout(() => commitPreventNotificationTerms(preventTermsInput), TERMS_DEBOUNCE_MS);

        return () => clearTimeout(timeout);
    }, [preventTermsInput, questRelevancy.preventNotificationTerms, commitPreventNotificationTerms]);

    useEffect(() => () => {
        commitPreventNotificationTerms(latestPreventTerms.current);
        commitHiddenQuestTerms(latestHiddenTerms.current);
    }, [commitPreventNotificationTerms, commitHiddenQuestTerms]);

    const updatePreventNotificationCombinations = useCallback((combinations: QuestCombinationKey[]) => {
        getQuestifySettings().preventNotificationCombinations = combinations;
        validateIgnoredQuests();
    }, []);

    const updateHiddenQuestCombinations = useCallback((combinations: QuestCombinationKey[]) => {
        getQuestifySettings().hiddenQuestCombinations = combinations;
        validateIgnoredQuests();
    }, []);

    const preventNotificationComboProps = useQuestCombinationSelectProps({ value: questRelevancy.preventNotificationCombinations, onChange: updatePreventNotificationCombinations, taskTypes: allQuestTaskTypes });
    const hiddenQuestComboProps = useQuestCombinationSelectProps({ value: questRelevancy.hiddenQuestCombinations, onChange: updateHiddenQuestCombinations, taskTypes: allQuestTaskTypes });

    return (
        <SettingsCard>
            <SettingsHeader> Quest Relevancy </SettingsHeader>
            <SettingsDescription> Filter which Quests are eligible for various Questify settings. Quests that are queued, auto-completing, completed, or have any user progress are exempt from these filters. </SettingsDescription>
            <SettingsSubheader> Prevent Notifications </SettingsSubheader>
            <SettingsComboSelect
                label="Quests matching selected reward and task combinations will be ignored by Quest Button visibility, badge count, and new Quest alerts."
                disabled={disabled}
                maxOptionsVisible={7}
                placeholder="Search reward and task combinations..."
                {...preventNotificationComboProps}
            />
            <SettingsTextInput
                className="margin-top-9"
                label="Quests whose Quest name, game title, or publisher contains any of these terms will be ignored by Quest Button visibility, badge count, and new Quest alerts."
                value={preventTermsInput}
                disabled={disabled}
                placeholder="Separate terms with commas. Matching is case-insensitive."
                onChange={setPreventTermsInput}
                onBlur={() => commitPreventNotificationTerms(preventTermsInput)}
                onKeyDown={event => {
                    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                        commitPreventNotificationTerms(preventTermsInput);
                    }
                }}
                tooltip={{
                    position: "top",
                    wider: true,
                    text: TERMS_TOOLTIP_TEXT
                }}
            />
            <SettingsSubheader> Hide Quests </SettingsSubheader>
            <SettingsComboSelect
                label="Quests matching selected reward and task combinations will be hidden from the Quests page and ignored by all Questify settings, including alerts and auto-completion."
                disabled={disabled}
                maxOptionsVisible={7}
                placeholder="Search reward and task combinations..."
                {...hiddenQuestComboProps}
            />
            <SettingsTextInput
                className="margin-top-9"
                label="Quests whose Quest name, game title, or publisher contains any of these terms will be hidden from the Quests page and ignored by all Questify settings, including alerts and auto-completion."
                value={hiddenTermsInput}
                disabled={disabled}
                placeholder="Separate terms with commas. Matching is case-insensitive."
                onChange={setHiddenTermsInput}
                onBlur={() => commitHiddenQuestTerms(hiddenTermsInput)}
                onKeyDown={event => {
                    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                        commitHiddenQuestTerms(hiddenTermsInput);
                    }
                }}
                tooltip={{
                    position: "top",
                    wider: true,
                    text: TERMS_TOOLTIP_TEXT
                }}
            />
        </SettingsCard>
    );
}
