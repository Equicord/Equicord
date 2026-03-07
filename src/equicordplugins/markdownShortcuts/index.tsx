/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { insertTextIntoChatInputBox } from "@utils/discord";
import { Logger } from "@utils/Logger";
import { classes } from "@utils/misc";
import definePlugin from "@utils/types";

import managedStyle from "./styles.css?managed";

const cl = classNameFactory("vc-mdshortcuts-");
const logger = new Logger("MarkdownShortcuts");

interface MarkdownFormat {
    name: string;
    prefix: string;
    suffix: string;
    lineLevel: boolean;
    toolbarIcon: string | null;
    toolbarLabel: string;
}

function applyFormatToSelection(format: MarkdownFormat) {
    try {
        const selectedText = window.getSelection()?.toString() ?? "";
        const hasSelection = selectedText.length > 0;

        const replacement = format.lineLevel
            ? hasSelection ? format.prefix + selectedText : format.prefix
            : hasSelection ? format.prefix + selectedText + format.suffix : format.prefix + format.suffix;

        insertTextIntoChatInputBox(replacement);
    } catch (err) {
        logger.error("Failed to apply format", format.name, err);
    }
}

const TOOLBAR_FORMATS: MarkdownFormat[] = [
    {
        name: "Underline",
        prefix: "__",
        suffix: "__",
        lineLevel: false,
        toolbarIcon: "U",
        toolbarLabel: "Underline"
    },
    {
        name: "Subtext",
        prefix: "-# ",
        suffix: "",
        lineLevel: true,
        toolbarLabel: "Subtext",
        toolbarIcon: "-#",
    },
    {
        name: "Header 1",
        prefix: "# ",
        suffix: "",
        lineLevel: true,
        toolbarLabel: "Header 1",
        toolbarIcon: "H1",
    },
    {
        name: "Header 2",
        prefix: "## ",
        suffix: "",
        lineLevel: true,
        toolbarLabel: "Header 2",
        toolbarIcon: "H2",
    },
    {
        name: "Header 3",
        prefix: "### ",
        suffix: "",
        lineLevel: true,
        toolbarLabel: "Header 3",
        toolbarIcon: "H3",
    },
    {
        name: "Block Quote Multi",
        prefix: ">>> ",
        suffix: "",
        lineLevel: true,
        toolbarLabel: "Block Quote (Multi-line)",
        toolbarIcon: ">>",
    },
    {
        name: "Code Block",
        prefix: "```\n",
        suffix: "\n```",
        lineLevel: false,
        toolbarLabel: "Code Block",
        toolbarIcon: "{/}",
    },
];

export default definePlugin({
    name: "MarkdownShortcuts",
    description: "Adds toolbar buttons for Markdown formatting in chat input.",
    authors: [EquicordDevs.feniks],
    managedStyle,
    patches: [
        {
            find: 'id:"slate-toolbar"',
            replacement: {
                match: /(children:)\(0,(\i)\.jsx\)\((\i),\{editorRef:(\i),options:(\i)\}\)/,
                replace: '$1(0,$2.jsxs)("div",{className:$self.toolbarRowsClass,children:[(0,$2.jsx)($3,{editorRef:$4,options:$5}),$self.renderToolbarButtons()]})'
            }
        }
    ],
    toolbarRowsClass: cl("rows"),

    renderToolbarButtons() {
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
