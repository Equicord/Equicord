import assert from "node:assert/strict";

import { normalizeActionKey, resolveActionByActionKey, resolveActionIntentByActionKey, type ActionRoutingAction } from "../../src/equicordplugins/commandPalette/actions/actionRouting";
import { createExecuteSecondaryAction, formatActionChordLabel } from "../../src/equicordplugins/commandPalette/extensions/actions/actionHelpers";
import { resolvePaletteActions } from "../../src/equicordplugins/commandPalette/ui/actions/resolvePaletteActions";

function runNormalizationChecks() {
    assert.equal(normalizeActionKey("meta+enter"), "meta+enter");
    assert.equal(normalizeActionKey("Enter+Cmd"), "meta+enter");
    assert.equal(normalizeActionKey("⌘↵"), "meta+enter");
    assert.equal(normalizeActionKey("  shift +  ⌘ + enter "), "meta+shift+enter");
    assert.equal(normalizeActionKey("ctrl+alt+enter+ctrl"), "alt+ctrl+enter");
    assert.equal(normalizeActionKey("esc"), "esc");
}

function runActionIntentChecks() {
    const actions: ActionRoutingAction[] = [
        {
            id: "toggle-auto",
            shortcut: "Cmd+Enter",
            intent: { type: "execute-secondary", actionKey: "meta+shift+enter" }
        },
        {
            id: "Open Settings",
            shortcut: "Ctrl+S",
            intent: { type: "go-back" }
        }
    ];

    const primaryIntent = resolveActionIntentByActionKey(actions, "primary");
    assert.deepEqual(primaryIntent, { type: "execute-primary" });

    const secondaryIntent = resolveActionIntentByActionKey(actions, "⌘⇧↵");
    assert.deepEqual(secondaryIntent, { type: "execute-secondary", actionKey: "meta+shift+enter" });

    const shortcutIntent = resolveActionIntentByActionKey(actions, "ctrl+s");
    assert.equal(shortcutIntent?.type, "go-back");

    const idIntent = resolveActionIntentByActionKey(actions, "open+settings");
    assert.equal(idIntent?.type, "go-back");

    const noMatchIntent = resolveActionIntentByActionKey(actions, "alt+enter");
    assert.equal(noMatchIntent, null);

    const resolvedSecondary = resolveActionByActionKey(actions, "meta+shift+enter");
    assert.equal(resolvedSecondary?.matchSource, "intent-action-key");
}

function runResolverChecks() {
    const selectedCommand = {
        id: "test-command",
        label: "Test command",
        handler: () => undefined,
        actions: () => [
            {
                id: "execute",
                label: "Execute",
                shortcut: "↵",
                intent: { type: "execute-primary" as const }
            }
        ]
    };

    const pageActions = resolvePaletteActions({
        activePage: { id: "send-dm", submitLabel: "Send DM" },
        hasCalculatorResult: false,
        selectedCommand: null,
        selectedCommandPinned: false,
        canGoBack: true,
        canDrillDown: false,
        drilldownCategoryId: null
    });
    assert.deepEqual(pageActions.map(action => action.id), ["page-submit-send-dm", "back"]);

    const calculatorActions = resolvePaletteActions({
        activePage: null,
        hasCalculatorResult: true,
        selectedCommand: null,
        selectedCommandPinned: false,
        canGoBack: false,
        canDrillDown: false,
        drilldownCategoryId: null
    });
    assert.deepEqual(calculatorActions.map(action => action.id), ["copy-answer", "copy-raw", "copy-qa"]);

    const commandActions = resolvePaletteActions({
        activePage: null,
        hasCalculatorResult: false,
        selectedCommand,
        selectedCommandPinned: false,
        canGoBack: true,
        canDrillDown: false,
        drilldownCategoryId: null
    });
    assert.deepEqual(commandActions.map(action => action.id), ["execute", "pin-command", "back"]);
}

function runExtensionActionHelperChecks() {
    assert.equal(formatActionChordLabel("meta+enter"), "Cmd+ENTER");
    assert.equal(formatActionChordLabel("meta+shift+enter"), "Cmd+SHIFT+ENTER");

    const action = createExecuteSecondaryAction({
        id: "toggle-global",
        label: "Toggle global",
        chord: "meta+shift+enter",
        handler: () => undefined
    });

    assert.equal(action.id, "toggle-global");
    assert.equal(action.shortcut, "Cmd+SHIFT+ENTER");
    assert.deepEqual(action.intent, { type: "execute-secondary", actionKey: "meta+shift+enter" });
}

function main() {
    runNormalizationChecks();
    runActionIntentChecks();
    runResolverChecks();
    runExtensionActionHelperChecks();
    console.log("CommandPalette action routing checks passed.");
}

main();
