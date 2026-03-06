/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { Logger } from "@utils/Logger";
import { classes } from "@utils/misc";
import definePlugin, { OptionType } from "@utils/types";

import { createKeybindRecorderComponent } from "./components/KeybindRecorder";
import managedStyle from "./styles.css?managed";
import { MarkdownFormat, MarkdownShortcutsSettingsStore } from "./types";
import { applyFormatToSelection, isEditableTarget, KeyEventLike, matchesKeybind } from "./utils";

const cl = classNameFactory("vc-mdshortcuts-");
const logger = new Logger("MarkdownShortcuts");

const FORMATS: MarkdownFormat[] = [
    { name: "Bold", prefix: "**", suffix: "**", settingKey: "boldShortcut", lineLevel: false, toolbarIcon: null, toolbarLabel: "Bold", defaultKeybind: ["ctrl", "b"] },
    { name: "Italic", prefix: "*", suffix: "*", settingKey: "italicShortcut", lineLevel: false, toolbarIcon: null, toolbarLabel: "Italic", defaultKeybind: ["ctrl", "i"] },
    {
        name: "Underline", prefix: "__", suffix: "__", settingKey: "underlineShortcut", lineLevel: false, toolbarLabel: "Underline",
        toolbarIcon: "U",
        defaultKeybind: ["ctrl", "u"]
    },
    { name: "Strikethrough", prefix: "~~", suffix: "~~", settingKey: "strikethroughShortcut", lineLevel: false, toolbarIcon: null, toolbarLabel: "Strikethrough", defaultKeybind: ["ctrl", "shift", "x"] },
    { name: "Spoiler", prefix: "||", suffix: "||", settingKey: "spoilerShortcut", lineLevel: false, toolbarIcon: null, toolbarLabel: "Spoiler", defaultKeybind: ["ctrl", "shift", "s"] },
    { name: "Inline Code", prefix: "`", suffix: "`", settingKey: "inlineCodeShortcut", lineLevel: false, toolbarIcon: null, toolbarLabel: "Inline Code", defaultKeybind: ["ctrl", "e"] },
    {
        name: "Code Block", prefix: "```\n", suffix: "\n```", settingKey: "codeBlockShortcut", lineLevel: false, toolbarLabel: "Code Block",
        toolbarIcon: "{/}",
        defaultKeybind: ["ctrl", "shift", "e"]
    },
    {
        name: "Header 1", prefix: "# ", suffix: "", settingKey: "header1Shortcut", lineLevel: true, toolbarLabel: "Header 1",
        toolbarIcon: "H1",
        defaultKeybind: ["ctrl", "shift", "1"]
    },
    {
        name: "Header 2", prefix: "## ", suffix: "", settingKey: "header2Shortcut", lineLevel: true, toolbarLabel: "Header 2",
        toolbarIcon: "H2",
        defaultKeybind: ["ctrl", "shift", "2"]
    },
    {
        name: "Header 3", prefix: "### ", suffix: "", settingKey: "header3Shortcut", lineLevel: true, toolbarLabel: "Header 3",
        toolbarIcon: "H3",
        defaultKeybind: ["ctrl", "shift", "3"]
    },
    {
        name: "Subtext", prefix: "-# ", suffix: "", settingKey: "subtextShortcut", lineLevel: true, toolbarLabel: "Subtext",
        toolbarIcon: "-#",
        defaultKeybind: ["ctrl", "shift", "t"]
    },
    { name: "Block Quote", prefix: "> ", suffix: "", settingKey: "blockQuoteShortcut", lineLevel: true, toolbarIcon: null, toolbarLabel: "Block Quote", defaultKeybind: ["ctrl", "shift", "q"] },
    {
        name: "Block Quote Multi", prefix: ">>> ", suffix: "", settingKey: "blockQuoteMultiShortcut", lineLevel: true, toolbarLabel: "Block Quote (Multi-line)",
        toolbarIcon: ">>",
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
    description: "Bulk actions for all keyboard shortcuts.",
    component: () => {
        const isShortcutsEnabled = settings.store.enableShortcuts;

        const handleDisableAll = () => {
            const store = settings.store as MarkdownShortcutsSettingsStore;
            for (const format of FORMATS) {
                store[format.settingKey] = [];
            }
        };

        const handleResetAll = () => {
            const store = settings.store as MarkdownShortcutsSettingsStore;
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
        component: createKeybindRecorderComponent(format, FORMATS, () => settings.store as MarkdownShortcutsSettingsStore),
    };
}

const settings = definePluginSettings(settingsDefinition);

function isKeyEventLike(value: unknown): value is KeyEventLike {
    if (!value || typeof value !== "object") return false;

    const event = value as Partial<KeyEventLike>;
    return typeof event.key === "string"
        && typeof event.code === "string"
        && typeof event.preventDefault === "function"
        && typeof event.stopPropagation === "function";
}

function handleKeyDown(e: KeyEventLike) {
    if (!isEditableTarget(e.target)) return;

    const store = settings.store as MarkdownShortcutsSettingsStore;
    if (!store.enableShortcuts) return;

    for (const format of FORMATS) {
        const rawKeybind = store[format.settingKey];
        let keybind = Array.isArray(rawKeybind) ? rawKeybind : undefined;
        if (!keybind) {
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
    patches: [
        {
            find: 'id:"slate-toolbar"',
            replacement: {
                match: /(children:)\(0,(\i)\.jsx\)\((\i),\{editorRef:(\i),options:(\i)\}\)/,
                replace: '$1(0,$2.jsxs)("div",{className:$self.toolbarRowsClass,children:[(0,$2.jsx)($3,{editorRef:$4,options:$5}),$self.renderToolbarButtons()]})'
            }
        },
        {
            find: ".SLASH_COMMAND_SUGGESTIONS_TOGGLED,{",
            replacement: [
                {
                    match: /onKeyDown:(\i)(?=,)/,
                    replace: "onKeyDown:$self.wrapChatInputKeyDown($1)"
                },
                {
                    match: /(?<=onKeyDown:(\i)=>\{)/,
                    replace: "$self.handlePatchedKeyDown($1);",
                    noWarn: true
                },
                {
                    match: /(?<=onKeyDown:function\((\i)\)\{)/,
                    replace: "$self.handlePatchedKeyDown($1);",
                    noWarn: true
                }
            ]
        }
    ],
    toolbarRowsClass: cl("rows"),

    handlePatchedKeyDown(event: unknown) {
        if (!isKeyEventLike(event)) return;
        handleKeyDown(event);
    },

    wrapChatInputKeyDown(handler: ((event: unknown) => void) | undefined) {
        return (event: unknown) => {
            this.handlePatchedKeyDown(event);
            handler?.(event);
        };
    },

    renderToolbarButtons() {
        if (!settings.store.enableToolbarButtons) return null;

        return (
            <span key="vc-mdshortcuts-container" className={cl("container")}>
                {TOOLBAR_FORMATS.map(format => (
                    <button
                        key={format.name}
                        type="button"
                        className={cl("btn")}
                        aria-label={format.toolbarLabel}
                        title={format.toolbarLabel}
                        onMouseDown={e => {
                            e.preventDefault();
                            e.stopPropagation();
                        }}
                        onClick={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            applyFormatToSelection(format);
                        }}
                    >
                        <span
                            className={format.name === "Underline"
                                ? classes(cl("toolbar-icon"), cl("toolbar-icon-underline"))
                                : cl("toolbar-icon")}
                        >
                            {format.toolbarIcon ?? format.name[0]}
                        </span>
                    </button>
                ))}
            </span>
        );
    },

    start() {
        logger.info("Started");
    },

    stop() {
        logger.info("Stopped");
    },
});
