/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findGroupChildrenByChildId } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import { insertTextIntoChatInputBox } from "@utils/discord";
import { Logger } from "@utils/Logger";
import definePlugin, { IconComponent, OptionType } from "@utils/types";
import { ChannelStore, ComponentDispatch, FluxDispatcher, Menu, MessageStore, SelectedChannelStore, useEffect, useRef, UserStore, useState } from "@webpack/common";

interface SlatePoint {
    path: number[];
    offset: number;
}

interface SlateRange {
    anchor: SlatePoint;
    focus: SlatePoint;
}

interface SlateNode {
    type?: string;
    children?: SlateNode[];
    text?: string;
}

type SlateOperation =
    | {
        type: "set_node";
        path: number[];
        properties: Record<string, unknown>;
        newProperties: Record<string, unknown>;
    }
    | {
        type: "insert_node";
        path: number[];
        node: SlateNode;
    }
    | {
        type: "set_selection";
        properties: SlateRange | null;
        newProperties: SlateRange;
    };

interface SlateEditor {
    children: SlateNode[];
    selection: SlateRange | null;
    insertBreak?: () => void;
    apply?: (op: SlateOperation) => void;
}

interface FiberNode {
    memoizedProps?: { editor?: SlateEditor };
    stateNode?: { editor?: SlateEditor };
    return?: FiberNode | null;
}

const DEFAULT_KEYBIND = "Alt+C";
const MAX_FIBER_DEPTH = 40;
const logger = new Logger("QuoteSelection");

function KeybindSettingsComponent({ setValue }: { setValue?: (val: string) => void }) {
    const { keybind, enableKeybind } = settings.use(["keybind", "enableKeybind"]);
    const [recording, setRecording] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleInterceptReset = (e: MouseEvent) => {
            const dialog = containerRef.current?.closest('[role="dialog"]');
            const target = e.target as HTMLElement | null;
            const button = target?.closest("button");
            if (!dialog || !button || !dialog.contains(button)) return;

            if (button.textContent?.trim().toLowerCase() === "reset") {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                setRecording(false);
                settings.store.keybind = DEFAULT_KEYBIND;
                settings.store.enableKeybind = false;
                setValue?.(DEFAULT_KEYBIND);
            }
        };

        window.addEventListener("click", handleInterceptReset, true);
        return () => window.removeEventListener("click", handleInterceptReset, true);
    }, [setValue]);

    useEffect(() => {
        if (!recording) return;

        const handleRecordKey = (e: KeyboardEvent) => {
            e.preventDefault();
            e.stopPropagation();

            if (e.key === "Escape") {
                setRecording(false);
                return;
            }

            if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return;

            const parts: string[] = [];
            if (e.ctrlKey) parts.push("Ctrl");
            if (e.altKey) parts.push("Alt");
            if (e.metaKey) parts.push("Meta");
            if (e.shiftKey) parts.push("Shift");

            const mainKey = e.key === " " ? "Space" : e.key.length === 1 ? e.key.toUpperCase() : e.key;
            parts.push(mainKey);

            const nextBind = parts.join("+");
            settings.store.keybind = nextBind;
            setValue?.(nextBind);
            setRecording(false);
        };

        window.addEventListener("keydown", handleRecordKey, true);
        return () => window.removeEventListener("keydown", handleRecordKey, true);
    }, [recording, setValue]);

    return (
        <div ref={containerRef} style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "4px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div style={{ color: "var(--header-primary)", fontWeight: 500, fontSize: "16px" }}>
                        Enable Keyboard Shortcut
                    </div>
                    <div style={{ color: "var(--text-muted)", fontSize: "14px" }}>
                        Quote selected text using a shortcut (Hold Shift with shortcut for Diff mode)
                    </div>
                </div>
                <div
                    role="switch"
                    aria-checked={enableKeybind}
                    onClick={() => {
                        settings.store.enableKeybind = !enableKeybind;
                    }}
                    style={{
                        width: "40px",
                        height: "24px",
                        borderRadius: "12px",
                        backgroundColor: enableKeybind ? "var(--status-positive)" : "var(--primary-400)",
                        position: "relative",
                        cursor: "pointer",
                        transition: "background-color 0.15s ease",
                        flexShrink: 0
                    }}
                >
                    <div
                        style={{
                            width: "18px",
                            height: "18px",
                            borderRadius: "50%",
                            backgroundColor: "#ffffff",
                            position: "absolute",
                            top: "3px",
                            left: enableKeybind ? "19px" : "3px",
                            transition: "left 0.15s ease"
                        }}
                    />
                </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ color: "var(--header-primary)", fontWeight: 500, fontSize: "16px" }}>
                    Shortcut Keybind
                </div>
                <div
                    onClick={() => setRecording(true)}
                    style={{
                        padding: "10px 12px",
                        borderRadius: "4px",
                        backgroundColor: "var(--input-background)",
                        border: recording ? "1px solid var(--status-danger)" : "1px solid var(--input-border)",
                        color: recording ? "var(--status-danger)" : "var(--header-primary)",
                        fontWeight: 600,
                        fontSize: "14px",
                        cursor: "pointer",
                        userSelect: "none"
                    }}
                >
                    {recording ? "Press any key combination... (Esc to cancel)" : (keybind || DEFAULT_KEYBIND)}
                </div>
            </div>
        </div>
    );
}

const settings = definePluginSettings({
    enableKeybind: {
        type: OptionType.BOOLEAN,
        description: "Enable keyboard shortcut",
        default: false,
        hidden: true
    },
    keybind: {
        type: OptionType.COMPONENT,
        description: "Click the box to record a custom shortcut",
        default: DEFAULT_KEYBIND,
        component: KeybindSettingsComponent
    }
});

const QuoteIcon: IconComponent = props => (
    <svg width="20" height="20" viewBox="0 0 24 24" {...props}>
        <path fill="currentColor" d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z" />
    </svg>
);

export default definePlugin({
    name: "QuoteSelection",
    authors: [EquicordDevs.Mireko],
    description: "Quote & reply to selected message text via context menu or custom keybind",
    settings,

    start() {
        document.addEventListener("keydown", onKeyDown);
    },

    stop() {
        document.removeEventListener("keydown", onKeyDown);
    },

    contextMenus: {
        message(children, props) {
            if (!props?.message?.id) return;

            const selection = window.getSelection();
            if (!selection || selection.isCollapsed || !selection.rangeCount) return;

            const text = selection.toString().trim();
            if (!text) return;

            const { anchorNode } = selection;
            const element = anchorNode instanceof Element ? anchorNode : anchorNode?.parentElement;

            const messageElement = element?.closest(`#message-content-${props.message.id}`);
            if (!messageElement) return;

            const codeBlock = element?.closest("code, pre");
            const isCodeBlock = !!codeBlock;
            const language = getCodeLanguage(codeBlock);

            const customBind = settings.store.enableKeybind ? (settings.store.keybind || DEFAULT_KEYBIND) : "";
            const subtextLabel = customBind ? `${customBind} (Shift for Diff)` : "Shift+Click for Diff";

            const menuItem = (
                <Menu.MenuItem
                    key="vc-quote-selection"
                    id="vc-quote-selection"
                    label="Reply with Quote"
                    subtext={subtextLabel}
                    icon={QuoteIcon}
                    leadingAccessory={{ type: "icon", icon: QuoteIcon }}
                    action={e => {
                        triggerQuoteReply(props.message, text, isCodeBlock, language, e?.shiftKey ? "diff" : "quote");
                    }}
                />
            );

            const group = findGroupChildrenByChildId("reply", children) ?? findGroupChildrenByChildId("copy", children);
            if (group) {
                const replyIndex = group.findIndex(c => c?.props?.id === "reply");
                group.splice(replyIndex !== -1 ? replyIndex + 1 : 0, 0, menuItem);
            } else {
                children.push(menuItem);
            }
        }
    }
});

function matchesKeybind(e: KeyboardEvent, combo: string): { matched: boolean; explicitShift: boolean } {
    const parts = combo.toLowerCase().split("+").map(s => s.trim()).filter(Boolean);
    if (!parts.length) return { matched: false, explicitShift: false };

    const mainKey = parts[parts.length - 1];
    const needCtrl = parts.includes("ctrl") || parts.includes("control");
    const needAlt = parts.includes("alt") || parts.includes("option");
    const needMeta = parts.includes("meta") || parts.includes("cmd") || parts.includes("win");
    const needShift = parts.includes("shift");

    if (e.ctrlKey !== needCtrl || e.altKey !== needAlt || e.metaKey !== needMeta) {
        return { matched: false, explicitShift: false };
    }
    if (needShift && !e.shiftKey) {
        return { matched: false, explicitShift: false };
    }

    const pressedKey = e.key === " " ? "space" : e.key.toLowerCase();
    return {
        matched: pressedKey === mainKey,
        explicitShift: needShift
    };
}

function onKeyDown(e: KeyboardEvent) {
    if (!settings.store.enableKeybind) return;
    const activeBind = settings.store.keybind || DEFAULT_KEYBIND;

    const { matched, explicitShift } = matchesKeybind(e, activeBind);
    if (!matched) return;

    try {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || !selection.rangeCount) return;

        const text = selection.toString().trim();
        if (!text) return;

        const { anchorNode } = selection;
        const element = anchorNode instanceof Element ? anchorNode : anchorNode?.parentElement;
        const messageElement = element?.closest('[id^="message-content-"]');
        if (!messageElement) return;

        const messageId = messageElement.id.replace("message-content-", "");
        const channelId = SelectedChannelStore.getChannelId();
        if (!channelId || !messageId) return;

        const message = MessageStore.getMessage(channelId, messageId);
        if (!message) return;

        e.preventDefault();
        e.stopPropagation();

        const codeBlock = element?.closest("code, pre");
        const isCodeBlock = !!codeBlock;
        const language = getCodeLanguage(codeBlock);

        const mode = !explicitShift && e.shiftKey ? "diff" : "quote";
        triggerQuoteReply(message, text, isCodeBlock, language, mode);
    } catch (err) {
        logger.error("Failed to execute keybind quote", err);
    }
}

function getChatSlateInstance(): { el: HTMLElement; editor: SlateEditor } | null {
    const editors = document.querySelectorAll<HTMLElement>('[data-slate-editor="true"]');
    const el = editors[editors.length - 1];
    if (!el) return null;

    const fiberKey = Object.keys(el).find(k => k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$"));
    if (!fiberKey) return null;

    let fiber = (el as unknown as Record<string, FiberNode | undefined>)[fiberKey];
    let depth = 0;
    while (fiber && !fiber.memoizedProps?.editor && !fiber.stateNode?.editor && depth < MAX_FIBER_DEPTH) {
        fiber = fiber.return ?? undefined;
        depth++;
    }

    const editor = fiber?.memoizedProps?.editor ?? fiber?.stateNode?.editor;
    if (!editor || !Array.isArray(editor.children)) return null;

    return { el, editor };
}

function getNodeText(node: SlateNode | undefined): string {
    if (!node) return "";
    if (typeof node.text === "string") return node.text;
    if (Array.isArray(node.children)) return node.children.map(getNodeText).join("");
    return "";
}

function triggerQuoteReply(
    message: { id: string; channel_id: string; author?: { id: string } },
    text: string,
    isCodeBlock: boolean,
    language: string,
    mode: "quote" | "diff"
) {
    window.getSelection()?.removeAllRanges();

    const channel = ChannelStore.getChannel(message.channel_id);

    if (channel) {
        FluxDispatcher.dispatch({
            type: "CREATE_PENDING_REPLY",
            channel,
            message,
            shouldMention: true,
            showMentionToggle: !channel.isPrivate?.() && message.author?.id !== UserStore.getCurrentUser()?.id
        });
        ComponentDispatch.dispatchToLastSubscribed("TEXTAREA_FOCUS");
    }

    try {
        const instance = getChatSlateInstance();
        if (instance) {
            const { el, editor } = instance;
            el.focus();
            const lastIdx = editor.children.length - 1;
            const lastText = getNodeText(editor.children[lastIdx]);

            if (lastText.trim().length > 0) {
                const newLineIdx = editor.children.length;
                editor.apply?.({
                    type: "insert_node",
                    path: [newLineIdx],
                    node: { type: "line", children: [{ text: "" }] }
                });
                const point = { path: [newLineIdx, 0], offset: 0 };
                editor.apply?.({
                    type: "set_selection",
                    properties: editor.selection ?? null,
                    newProperties: { anchor: point, focus: point }
                });
            }
        }
    } catch (err) {
        logger.error("Failed to prepare new line before quote", err);
    }

    const replyText = formatQuote(text, isCodeBlock, language, mode);
    insertTextIntoChatInputBox(replyText);

    if (!isCodeBlock && mode === "quote") {
        appendCleanLineBelowQuote();
    }
}

function formatQuote(text: string, isCodeBlock: boolean, language: string, mode: "quote" | "diff" = "quote") {
    if (mode === "diff") {
        const fence = "```";
        const content = text.split("\n").map(line => `- ${line}`).join("\n");
        return `${fence}diff\n${content}\n+ \n${fence}\n`;
    }

    if (isCodeBlock) {
        const backticks = text.match(/`+/g);
        const maxBackticks = backticks ? Math.max(...backticks.map(s => s.length)) : 0;
        const fenceLength = Math.max(3, maxBackticks + 1);
        const fence = "`".repeat(fenceLength);

        return `${fence}${language}\n${text}\n${fence}\n`;
    }

    return `> ${text.split("\n").join("\n> ")}`;
}

function appendCleanLineBelowQuote() {
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            try {
                const instance = getChatSlateInstance();
                if (!instance) return;
                const { el, editor } = instance;
                el.focus();

                const lastIdx = editor.children.length - 1;
                const lastNode = editor.children[lastIdx];
                const lastText = getNodeText(lastNode);

                if (lastNode?.type === "blockQuote" && lastText.length === 0) {
                    editor.apply?.({
                        type: "set_node",
                        path: [lastIdx],
                        properties: { type: "blockQuote" },
                        newProperties: { type: "line" }
                    });
                    const point = { path: [lastIdx, 0], offset: 0 };
                    editor.apply?.({
                        type: "set_selection",
                        properties: editor.selection ?? null,
                        newProperties: { anchor: point, focus: point }
                    });
                } else {
                    const newLineIdx = editor.children.length;
                    editor.apply?.({
                        type: "insert_node",
                        path: [newLineIdx],
                        node: { type: "line", children: [{ text: "" }] }
                    });
                    const point = { path: [newLineIdx, 0], offset: 0 };
                    editor.apply?.({
                        type: "set_selection",
                        properties: editor.selection ?? null,
                        newProperties: { anchor: point, focus: point }
                    });
                }
            } catch (err) {
                logger.error("Failed to append clean line below quote", err);
            }
        });
    });
}

function getCodeLanguage(codeBlock: Element | null | undefined): string {
    if (!codeBlock) return "";
    const classes = Array.from(codeBlock.classList);

    const prefixedClass = classes.find(c => c.startsWith("language-"));
    if (prefixedClass) return prefixedClass.replace("language-", "");

    if (classes.includes("hljs")) {
        return classes.find(c => c !== "hljs" && !c.startsWith("scrollbar")) ?? "";
    }

    return "";
}
