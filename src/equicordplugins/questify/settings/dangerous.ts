/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { getQuestifySettings } from "./access";
import { defaultAllowChangingDangerousSettings, defaultAutoCompleteQuestsSimultaneously, defaultAutoCompleteQuestTypes, defaultCompleteVideoQuestsQuicker, defaultHideNonAutoCompletableQuests, defaultMakeMobileVideoQuestsDesktopCompatible, defaultPreventVideoQuestsPausing, defaultResumeInterruptedQuests } from "./def";
import { validateIgnoredQuests } from "./ignoredQuests";

export function resetDangerousSettings(): void {
    const settings = getQuestifySettings();

    settings.allowChangingDangerousSettings = defaultAllowChangingDangerousSettings;
    settings.autoCompleteQuestsSimultaneously = defaultAutoCompleteQuestsSimultaneously;
    settings.completeVideoQuestsQuicker = defaultCompleteVideoQuestsQuicker;
    settings.hideNonAutoCompletableQuests = defaultHideNonAutoCompletableQuests;
    settings.makeMobileVideoQuestsDesktopCompatible = defaultMakeMobileVideoQuestsDesktopCompatible;
    settings.preventVideoQuestsPausing = defaultPreventVideoQuestsPausing;
    settings.resumeInterruptedQuests = defaultResumeInterruptedQuests;
    settings.autoCompleteQuestTypes = { ...defaultAutoCompleteQuestTypes };

    validateIgnoredQuests();
}
