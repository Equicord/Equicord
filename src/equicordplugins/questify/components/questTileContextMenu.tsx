/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { copyToClipboard } from "@utils/clipboard";
import type { Quest } from "@vencord/discord-types";
import { Menu } from "@webpack/common";
import type { ReactNode } from "react";

import { addIgnoredQuest, questIsIgnored, removeIgnoredQuest } from "../settings/ignoredQuests";
import { rerenderQuests } from "../settings/rerender";
import { enrollQuest, getQuestAutoCompleteEntry, getQuestButtonProps, stopQuestAutoComplete } from "../utils/completion";
import { getQuestStatus, QuestStatus } from "../utils/questState";
import { q } from "../utils/ui";

export function QuestTileContextMenu(
    children: ReactNode[],
    props: { quest?: Quest; },
    isClaimedMenu: boolean = false,
): void {
    const { quest } = props;

    if (!quest) {
        return;
    }

    const isIgnored = questIsIgnored(quest.id);
    const isEnrolled = Boolean(quest.userStatus?.enrolledAt);
    const isAutoCompleting = getQuestAutoCompleteEntry(quest) != null;
    const autoCompleteProps = !isClaimedMenu ? getQuestButtonProps({ quest }) : null;
    const canEnroll = !isClaimedMenu && !isEnrolled && !quest.userStatus?.completedAt
        && getQuestStatus(quest, [], false) === QuestStatus.Unclaimed;

    children.unshift((
        <Menu.MenuGroup>
            {!isClaimedMenu && (!isIgnored ? (
                <Menu.MenuItem
                    id={q("ignore-quest")}
                    label="Mark as Ignored"
                    action={() => addIgnoredQuest(quest.id)}
                />
            ) : (
                <Menu.MenuItem
                    id={q("unignore-quest")}
                    label="Unmark as Ignored"
                    action={() => removeIgnoredQuest(quest.id)}
                />
            ))}
            {canEnroll && (
                <Menu.MenuItem
                    id={q("enroll-quest")}
                    label="Enroll in Quest"
                    action={async () => {
                        await enrollQuest(quest);
                        rerenderQuests();
                    }}
                />
            )}
            {isAutoCompleting ? (
                <Menu.MenuItem
                    id={q("stop-auto-complete")}
                    label="Stop Auto-Complete"
                    action={() => {
                        stopQuestAutoComplete(quest, {
                            manual: true,
                            preserveResume: false,
                            terminalHeartbeat: true,
                        });
                        rerenderQuests();
                    }}
                />
            ) : autoCompleteProps ? (
                <Menu.MenuItem
                    id={q("start-auto-complete")}
                    label="Start Auto-Complete"
                    action={autoCompleteProps.onClick}
                />
            ) : null}
            <Menu.MenuItem
                id={q("copy-quest-id")}
                label="Copy Quest ID"
                action={() => copyToClipboard(quest.id)}
            />
        </Menu.MenuGroup>
    ));
}
