/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type {
    CommandActionContext,
    CommandActionDefinition,
    CommandEntry
} from "../../registry";
import type { PaletteActionItem } from "../CommandPaletteActionsMenu";

interface ResolvePaletteActionsInput {
    activePage: { id: string; submitLabel: string; } | null;
    hasCalculatorResult: boolean;
    selectedCommand: CommandEntry | null;
    selectedCommandPinned: boolean;
    canGoBack: boolean;
    canDrillDown: boolean;
    drilldownCategoryId: string | null;
}

function mapCommandActions(
    actionDefs: CommandActionDefinition[],
    context: CommandActionContext
): PaletteActionItem[] {
    const items: PaletteActionItem[] = [];

    for (const action of actionDefs) {
        if (action.isVisible && !action.isVisible(context)) continue;

        items.push({
            id: action.id,
            label: action.label,
            shortcut: action.shortcut,
            icon: action.icon,
            intent: action.intent,
            disabled: action.isEnabled ? !action.isEnabled(context) : false
        });
    }

    return items;
}

export function resolvePaletteActions({
    activePage,
    hasCalculatorResult,
    selectedCommand,
    selectedCommandPinned,
    canGoBack,
    canDrillDown,
    drilldownCategoryId
}: ResolvePaletteActionsInput): PaletteActionItem[] {
    const actions: PaletteActionItem[] = [];

    if (activePage) {
        actions.push({
            id: `page-submit-${activePage.id}`,
            label: activePage.submitLabel,
            shortcut: "⌘↵",
            intent: { type: "submit-active-page" }
        });
        actions.push({
            id: "back",
            label: "Go Back",
            shortcut: "Esc",
            intent: { type: "go-back" }
        });
        return actions;
    }

    if (hasCalculatorResult) {
        actions.push({
            id: "copy-answer",
            label: "Copy Answer",
            shortcut: "↵",
            intent: { type: "copy-calculator", mode: "formatted" }
        });
        actions.push({
            id: "copy-raw",
            label: "Copy Raw",
            shortcut: "⌘↵",
            intent: { type: "copy-calculator", mode: "raw" }
        });
        actions.push({
            id: "copy-qa",
            label: "Copy Q+A",
            shortcut: "⌘⇧↵",
            intent: { type: "copy-calculator", mode: "qa" }
        });
    } else if (selectedCommand) {
        const context: CommandActionContext = {
            command: selectedCommand,
            drilldownCategoryId,
            isPageOpen: false,
            hasCalculatorResult,
            canGoBack
        };

        if (selectedCommand.actions) {
            actions.push(...mapCommandActions(selectedCommand.actions(context), context));
        } else {
            actions.push({
                id: "execute",
                label: "Execute",
                shortcut: "↵",
                intent: { type: "execute-primary" }
            });

            if (canDrillDown && drilldownCategoryId) {
                actions.push({
                    id: "open",
                    label: "Open",
                    shortcut: "→",
                    intent: { type: "open-drilldown", categoryId: drilldownCategoryId }
                });
            }
        }

        actions.push({
            id: selectedCommandPinned ? "unpin-command" : "pin-command",
            label: selectedCommandPinned ? "Unpin Command" : "Pin Command",
            shortcut: "⌘P",
            intent: { type: "toggle-pin", commandId: selectedCommand.id }
        });
    }

    if (canGoBack) {
        actions.push({
            id: "back",
            label: "Go Back",
            shortcut: "←",
            intent: { type: "go-back" }
        });
    }

    return actions;
}
