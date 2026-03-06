/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IS_MAC } from "@utils/constants";
import { insertTextIntoChatInputBox } from "@utils/discord";
import { Logger } from "@utils/Logger";

import { MarkdownFormat } from "./types";

const logger = new Logger("MarkdownShortcuts");

export const MODIFIER_KEYS = new Set(["Control", "Shift", "Alt", "Meta"]);
export const DISCORD_BUILTIN_SHORTCUTS = ["ctrl+b", "ctrl+i", "ctrl+u", "ctrl+shift+x", "ctrl+e"];
export type KeyEventLike = Pick<KeyboardEvent, "altKey" | "code" | "ctrlKey" | "defaultPrevented" | "key" | "metaKey" | "preventDefault" | "shiftKey" | "stopPropagation" | "target">;

export function normalizeKeybindForComparison(keys: string[]): string {
    return keys.map(k => k.toLowerCase()).sort().join("+");
}

export function formatKeybindDisplay(keys: string[]): string {
    if (!keys.length) return "Not set";

    return keys.map(k => {
        const upper = k.toUpperCase();
        if (IS_MAC) {
            if (upper === "CTRL" || upper === "MOD") return "⌘";
            if (upper === "CONTROL") return "⌃";
            if (upper === "META") return "⌘";
            if (upper === "ALT") return "⌥";
            if (upper === "SHIFT") return "⇧";
        }
        return upper;
    }).join(" + ");
}

export function matchesKeybind(e: KeyEventLike, keybind: string[]): boolean {
    if (!keybind.length) return false;

    const pressed = e.key.toLowerCase();
    const code = e.code.toLowerCase().replace("key", "").replace("digit", "");

    let hasNonModifier = false;

    for (const key of keybind) {
        const lower = key.toLowerCase();
        switch (lower) {
            case "mod":
            case "ctrl":
                if (!(IS_MAC ? e.metaKey : e.ctrlKey)) return false;
                break;
            case "control":
                if (!e.ctrlKey) return false;
                break;
            case "meta":
            case "cmd":
                if (!e.metaKey) return false;
                break;
            case "shift":
                if (!e.shiftKey) return false;
                break;
            case "alt":
            case "option":
                if (!e.altKey) return false;
                break;
            default:
                hasNonModifier = true;
                if (pressed !== lower && code !== lower) return false;
        }
    }

    return hasNonModifier;
}

export function applyFormatToSelection(format: MarkdownFormat) {
    try {
        const selectedText = window.getSelection()?.toString() ?? "";
        const hasSelection = selectedText.length > 0;

        let replacement: string;
        if (format.lineLevel) {
            replacement = hasSelection ? format.prefix + selectedText : format.prefix;
        } else {
            replacement = hasSelection
                ? format.prefix + selectedText + format.suffix
                : format.prefix + format.suffix;
        }

        insertTextIntoChatInputBox(replacement);
    } catch (err) {
        logger.error("Failed to apply format", format.name, err);
    }
}

export function isEditableTarget(el: EventTarget | null): boolean {
    if (!el || !(el instanceof HTMLElement)) return false;
    return (
        el instanceof HTMLTextAreaElement ||
        el.contentEditable === "true" ||
        el.getAttribute("role") === "textbox"
    );
}
