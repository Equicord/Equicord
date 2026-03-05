/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";

import { createKeybindRecorderComponent } from "./components/KeybindRecorder";
import managedStyle from "./styles.css?managed";
import { ToolbarManager } from "./toolbar";
import { MarkdownFormat } from "./types";
import { applyFormatToSelection, isEditableTarget, matchesKeybind } from "./utils";

const cl = classNameFactory("vc-mdshortcuts-");
const logger = new Logger("MarkdownShortcuts");

const FORMATS: MarkdownFormat[] = [
    { name: "Bold", prefix: "**", suffix: "**", settingKey: "boldShortcut", lineLevel: false, toolbarIcon: null, toolbarLabel: "Bold", defaultKeybind: ["ctrl", "b"] },
    { name: "Italic", prefix: "*", suffix: "*", settingKey: "italicShortcut", lineLevel: false, toolbarIcon: null, toolbarLabel: "Italic", defaultKeybind: ["ctrl", "i"] },
    {
        name: "Underline", prefix: "__", suffix: "__", settingKey: "underlineShortcut", lineLevel: false, toolbarLabel: "Underline",
        toolbarIcon: '<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z"/></svg>',
        defaultKeybind: ["ctrl", "u"]
    },
    { name: "Strikethrough", prefix: "~~", suffix: "~~", settingKey: "strikethroughShortcut", lineLevel: false, toolbarIcon: null, toolbarLabel: "Strikethrough", defaultKeybind: ["ctrl", "shift", "x"] },
    { name: "Spoiler", prefix: "||", suffix: "||", settingKey: "spoilerShortcut", lineLevel: false, toolbarIcon: null, toolbarLabel: "Spoiler", defaultKeybind: ["ctrl", "shift", "s"] },
    { name: "Inline Code", prefix: "`", suffix: "`", settingKey: "inlineCodeShortcut", lineLevel: false, toolbarIcon: null, toolbarLabel: "Inline Code", defaultKeybind: ["ctrl", "e"] },
    {
        name: "Code Block", prefix: "```\n", suffix: "\n```", settingKey: "codeBlockShortcut", lineLevel: false, toolbarLabel: "Code Block",
        toolbarIcon: '<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><text x="12" y="17" text-anchor="middle" font-size="14" font-weight="bold" font-family="monospace">{/}</text></svg>',
        defaultKeybind: ["ctrl", "shift", "e"]
    },
    {
        name: "Header 1", prefix: "# ", suffix: "", settingKey: "header1Shortcut", lineLevel: true, toolbarLabel: "Header 1",
        toolbarIcon: '<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><text x="12" y="17" text-anchor="middle" font-size="16" font-weight="bold" font-family="sans-serif">H1</text></svg>',
        defaultKeybind: ["ctrl", "shift", "1"]
    },
    {
        name: "Header 2", prefix: "## ", suffix: "", settingKey: "header2Shortcut", lineLevel: true, toolbarLabel: "Header 2",
        toolbarIcon: '<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><text x="12" y="17" text-anchor="middle" font-size="16" font-weight="bold" font-family="sans-serif">H2</text></svg>',
        defaultKeybind: ["ctrl", "shift", "2"]
    },
    {
        name: "Header 3", prefix: "### ", suffix: "", settingKey: "header3Shortcut", lineLevel: true, toolbarLabel: "Header 3",
        toolbarIcon: '<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><text x="12" y="17" text-anchor="middle" font-size="16" font-weight="bold" font-family="sans-serif">H3</text></svg>',
        defaultKeybind: ["ctrl", "shift", "3"]
    },
    {
        name: "Subtext", prefix: "-# ", suffix: "", settingKey: "subtextShortcut", lineLevel: true, toolbarLabel: "Subtext",
        toolbarIcon: '<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><text x="12" y="17" text-anchor="middle" font-size="14" font-weight="bold" font-family="sans-serif">-#</text></svg>',
        defaultKeybind: ["ctrl", "shift", "t"]
    },
    { name: "Block Quote", prefix: "> ", suffix: "", settingKey: "blockQuoteShortcut", lineLevel: true, toolbarIcon: null, toolbarLabel: "Block Quote", defaultKeybind: ["ctrl", "shift", "q"] },
    {
        name: "Block Quote Multi", prefix: ">>> ", suffix: "", settingKey: "blockQuoteMultiShortcut", lineLevel: true, toolbarLabel: "Block Quote (Multi-line)",
        toolbarIcon: '<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/></svg>',
        defaultKeybind: ["ctrl", "alt", "q"]
    },
];

const TOOLBAR_ORDER = ["Underline", "Subtext", "Header 1", "Header 2", "Header 3", "Block Quote Multi", "Code Block"];
const TOOLBAR_FORMATS = TOOLBAR_ORDER.map(name => FORMATS.find(f => f.name === name)!).filter(Boolean);

const settingsDefinition: Record<string, any> = {};

settingsDefinition.enableToolbarButtons = {
    type: OptionType.BOOLEAN,
    description: "Add extra formatting buttons to the text selection toolbar.",
    default: true,
};

settingsDefinition.enableShortcuts = {
    type: OptionType.BOOLEAN,
    description: "Enable custom markdown keyboard shortcuts.",
    default: true,
};

settingsDefinition.shortcutControls = {
    type: OptionType.COMPONENT,
    description: "Bulk actions for all keyboard shortcuts:",
    component: () => {
        const isShortcutsEnabled = settings.store.enableShortcuts;

        const handleDisableAll = () => {
            const store = settings.store as Record<string, any>;
            for (const format of FORMATS) {
                store[format.settingKey] = [];
            }
        };

        const handleResetAll = () => {
            const store = settings.store as Record<string, any>;
            for (const format of FORMATS) {
                store[format.settingKey] = format.defaultKeybind || [];
            }
        };

        return (
            <div style={{
                display: "flex", gap: "10px", marginTop: "4px", marginBottom: "8px",
                paddingBottom: "12px", borderBottom: "1px solid var(--background-modifier-accent)",
                opacity: isShortcutsEnabled ? 1 : 0.4,
                pointerEvents: isShortcutsEnabled ? "auto" : "none"
            }}>
                <button
                    type="button"
                    className={cl("keybind-button")}
                    style={{ color: "var(--text-danger)" }}
                    onClick={handleDisableAll}
                >
                    Disable All Shortcuts
                </button>
                <button
                    type="button"
                    className={cl("keybind-button")}
                    onClick={handleResetAll}
                >
                    Reset to Defaults
                </button>
            </div>
        );
    }
};

for (const format of FORMATS) {
    settingsDefinition[format.settingKey] = {
        type: OptionType.COMPONENT,
        description: `Keyboard shortcut for ${format.name}. Click to record, Clear to disable.`,
        default: format.defaultKeybind || [],
        component: createKeybindRecorderComponent(format, FORMATS, () => settings.store),
    };
}

const settings = definePluginSettings(settingsDefinition);

function handleKeyDown(e: KeyboardEvent) {
    if (!isEditableTarget(e.target)) return;

    const store = settings.store as Record<string, any>;
    if (!store.enableShortcuts) return;

    for (const format of FORMATS) {
        let keybind: string[] = store[format.settingKey];
        if (!Array.isArray(keybind)) {
            keybind = format.defaultKeybind || [];
        }

        if (keybind.length && matchesKeybind(e, keybind)) {
            e.preventDefault();
            e.stopPropagation();
            applyFormatToSelection(format);
            return;
        }
    }

    for (const format of FORMATS) {
        if (format.defaultKeybind && format.defaultKeybind.length > 0 && matchesKeybind(e, format.defaultKeybind)) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
    }
}

export default definePlugin({
    name: "MarkdownShortcuts",
    description: "Adds customizable keyboard shortcuts and toolbar buttons for Markdown formatting in chat input.",
    authors: [EquicordDevs.feniks],
    settings,
    managedStyle,

    start() {
        document.addEventListener("keydown", handleKeyDown, true);

        if (settings.store.enableToolbarButtons) {
            ToolbarManager.start(TOOLBAR_FORMATS);
        }

        logger.info("Started");
    },

    stop() {
        document.removeEventListener("keydown", handleKeyDown, true);
        ToolbarManager.stop();
        logger.info("Stopped");
    },
});
