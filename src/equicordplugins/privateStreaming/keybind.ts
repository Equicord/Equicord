/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export function parseKeybind(value: string) {
    if (!value.trim()) return null;
    const parts = value.toLowerCase().replace(/\s/g, "").split("+");
    const key = parts.pop() ?? "";
    if (!/^(?:[a-z0-9]|f(?:[1-9]|1[0-9]|2[0-4]))$/.test(key)) return undefined;
    const modifiers = parts.map(part => part === "control" ? "ctrl" : part);
    if (new Set(modifiers).size !== modifiers.length || modifiers.some(part => !["ctrl", "alt", "shift"].includes(part))) return undefined;
    if (key.length === 1 && !modifiers.includes("ctrl") && !modifiers.includes("alt")) return undefined;
    const code = key.length > 1 ? key.toUpperCase() : /\d/.test(key) ? `Digit${key}` : `Key${key.toUpperCase()}`;
    return { code, ctrl: modifiers.includes("ctrl"), alt: modifiers.includes("alt"), shift: modifiers.includes("shift") };
}

export function matchesKeybind(event: KeyboardEvent, value: string) {
    const bind = parseKeybind(value);
    return Boolean(bind && !event.repeat && !event.isComposing && !event.metaKey && !event.getModifierState("AltGraph")
        && event.code === bind.code && event.ctrlKey === bind.ctrl && event.altKey === bind.alt && event.shiftKey === bind.shift);
}

export function validateKeybind(value: unknown, other: string): true | string {
    if (typeof value !== "string") return "Use a key such as Ctrl+Alt+P or F8, or leave blank.";
    const bind = parseKeybind(value);
    if (bind === undefined) return "Use a key such as Ctrl+Alt+P or F8, or leave blank.";
    const conflict = parseKeybind(other);
    if (bind && conflict && bind.code === conflict.code && bind.ctrl === conflict.ctrl
        && bind.alt === conflict.alt && bind.shift === conflict.shift)
        return "Use different shortcuts for capture protection and blur.";
    return true;
}
