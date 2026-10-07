/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { showNotification } from "@api/Notifications";
import { Logger } from "@utils/Logger";
import type { Quest } from "@vencord/discord-types";
import { NavigationRouter } from "@webpack/common/utils";

import { normalizeQuestName } from "./filtering";
import { QUEST_PAGE } from "./ui";

export const QL = new Logger("Questify");

export function notifyQuestCompletion(quest?: Quest): void {
    if (!quest) return;

    showNotification({
        title: "Quest Completed!",
        body: `The ${normalizeQuestName(quest)} Quest has completed.`,
        dismissOnClick: true,
        onClick: () => NavigationRouter.transitionTo(`${QUEST_PAGE}#${quest.id}`)
    });

    QL.log("NOTIFY_QUEST_COMPLETION", { quest });
}
