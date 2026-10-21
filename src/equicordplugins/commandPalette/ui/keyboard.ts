/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IS_MAC } from "@utils/constants";

const MODIFIERS = ["meta", "ctrl", "shift", "alt"] as const;

export function comboFromEvent(e: KeyboardEvent): string[] | null {
    const key = e.key.toLowerCase();
    if (key === "meta" || key === "control" || key === "shift" || key === "alt") return null;

    const combo: string[] = [];
    if (e.metaKey) combo.push("meta");
    if (e.ctrlKey) combo.push("ctrl");
    if (e.shiftKey) combo.push("shift");
    if (e.altKey) combo.push("alt");
    combo.push(key === " " ? "space" : key);
    return combo;
}

export function comboEquals(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    const normalize = (combo: string[]) => [...combo].map(k => k.toLowerCase()).sort().join("+");
    return normalize(a) === normalize(b);
}

const MAC_SYMBOLS: Record<string, string> = {
    meta: "\u2318",
    ctrl: "\u2303",
    shift: "\u21E7",
    alt: "\u2325"
};

const KEY_SYMBOLS: Record<string, string> = {
    enter: "\u21B5",
    arrowup: "\u2191",
    arrowdown: "\u2193",
    arrowleft: "\u2190",
    arrowright: "\u2192",
    backspace: "\u232B",
    escape: "esc"
};

export function formatComboKeys(combo: string[]): string[] {
    return combo.map(key => {
        const lower = key.toLowerCase();
        if (IS_MAC && MAC_SYMBOLS[lower]) return MAC_SYMBOLS[lower];
        if (!IS_MAC && (MODIFIERS as readonly string[]).includes(lower)) {
            return lower === "meta" ? "Win" : lower[0].toUpperCase() + lower.slice(1);
        }
        if (KEY_SYMBOLS[lower]) return KEY_SYMBOLS[lower];
        return lower.length === 1 ? lower.toUpperCase() : lower[0].toUpperCase() + lower.slice(1);
    });
}

export function formatCombo(combo: string[]): string {
    return formatComboKeys(combo).join(IS_MAC ? "" : "+");
}

const EDITING_KEYS = new Set(["a", "c", "v", "x", "z", "y", "arrowleft", "arrowright", "arrowup", "arrowdown", "backspace", "delete", "home", "end"]);

function isEditingCombo(e: KeyboardEvent): boolean {
    return EDITING_KEYS.has(e.key.toLowerCase());
}

export function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    return Boolean(target.closest("input, textarea, select, [contenteditable=true], [role=textbox]"));
}

type PaletteKeyHandler = (e: KeyboardEvent) => boolean;
type GlobalKeyHandler = (e: KeyboardEvent) => boolean;

let paletteHandler: PaletteKeyHandler | null = null;
let globalHandler: GlobalKeyHandler | null = null;
let hotkeysSuspended = false;

export function setHotkeysSuspended(suspended: boolean) {
    hotkeysSuspended = suspended;
}

export function setPaletteKeyHandler(handler: PaletteKeyHandler | null) {
    paletteHandler = handler;
}

export function setGlobalKeyHandler(handler: GlobalKeyHandler | null) {
    globalHandler = handler;
}

export function isPaletteCapturing() {
    return paletteHandler !== null;
}

function handleKeyDown(e: KeyboardEvent) {
    if (paletteHandler) {
        if (paletteHandler(e)) {
            e.preventDefault();
            e.stopImmediatePropagation();
            return;
        }

        if (isEditableTarget(e.target) || isEditableTarget(document.activeElement)) return;

        if ((e.metaKey || e.ctrlKey) && !isEditingCombo(e)) {
            e.preventDefault();
            e.stopImmediatePropagation();
        }
        return;
    }

    if (hotkeysSuspended) return;

    if (globalHandler?.(e)) {
        e.preventDefault();
        e.stopPropagation();
    }
}

function handleKeyUp(e: KeyboardEvent) {
    if (!paletteHandler) return;
    if (isEditableTarget(e.target) || isEditableTarget(document.activeElement)) return;
    if ((e.metaKey || e.ctrlKey) && !isEditingCombo(e)) {
        e.stopImmediatePropagation();
    }
}

export function installKeyboardListeners() {
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);
}

export function removeKeyboardListeners() {
    window.removeEventListener("keydown", handleKeyDown, true);
    window.removeEventListener("keyup", handleKeyUp, true);
    paletteHandler = null;
    globalHandler = null;
}
