/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { getQuestifySettings } from "./access";
import { defaultAllowChangingDangerousSettings, defaultAutoCompleteQuestCombinations, defaultAutoCompleteQuests, defaultAutoCompleteQuestsSimultaneously, defaultAutoEnrollQuests, defaultCompleteVideoQuestsQuicker, defaultHideNonAutoCompletableQuests, defaultMakeMobileVideoQuestsDesktopCompatible, defaultPreventVideoQuestsPausing, defaultResumeInterruptedQuests, defaultStaggerSequentialAutoCompletes } from "./def";
import { validateIgnoredQuests } from "./ignoredQuests";

export function resetDangerousSettings(): void {
    const settings = getQuestifySettings();

    settings.allowChangingDangerousSettings = defaultAllowChangingDangerousSettings;
    settings.autoEnrollQuests = defaultAutoEnrollQuests;
    settings.autoCompleteQuests = defaultAutoCompleteQuests;
    settings.staggerSequentialAutoCompletes = defaultStaggerSequentialAutoCompletes;
    settings.autoCompleteQuestsSimultaneously = defaultAutoCompleteQuestsSimultaneously;
    settings.completeVideoQuestsQuicker = defaultCompleteVideoQuestsQuicker;
    settings.hideNonAutoCompletableQuests = defaultHideNonAutoCompletableQuests;
    settings.makeMobileVideoQuestsDesktopCompatible = defaultMakeMobileVideoQuestsDesktopCompatible;
    settings.preventVideoQuestsPausing = defaultPreventVideoQuestsPausing;
    settings.resumeInterruptedQuests = defaultResumeInterruptedQuests;
    settings.autoCompleteQuestCombinations = Array.from(defaultAutoCompleteQuestCombinations);

    validateIgnoredQuests();
}
