/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { IS_MAC } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { Logger } from "@utils/Logger";
import { useEffect, useRef, useState } from "@webpack/common";
import { KeyboardEvent as ReactKeyboardEvent } from "react";

import { MarkdownFormat, MarkdownShortcutsSettingsStore } from "../types";
import { DISCORD_BUILTIN_SHORTCUTS, formatKeybindDisplay, MODIFIER_KEYS, normalizeKeybindForComparison } from "../utils";

const cl = classNameFactory("vc-mdshortcuts-");
const logger = new Logger("MarkdownShortcuts");

export function createKeybindRecorderComponent(
    format: MarkdownFormat,
    formats: MarkdownFormat[],
    getStore: () => MarkdownShortcutsSettingsStore
) {
    return function KeybindRecorderForFormat() {
        const [isListening, setIsListening] = useState(false);
        const [error, setError] = useState<string | null>(null);
        const recordButtonRef = useRef<HTMLButtonElement>(null);
        const store = getStore();
        const isShortcutsEnabled = store.enableShortcuts;

        const rawCurrentKeybind = store[format.settingKey];
        let currentKeybind = Array.isArray(rawCurrentKeybind) ? rawCurrentKeybind : undefined;
        if (!currentKeybind) {
            currentKeybind = format.defaultKeybind || [];
        }

        useEffect(() => {
            if (!isListening) return () => { };
            const raf = requestAnimationFrame(() => recordButtonRef.current?.focus());
            return () => cancelAnimationFrame(raf);
        }, [isListening]);

        const handleRecord = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
            if (!isListening) return;

            event.preventDefault();
            event.stopPropagation();

            const { nativeEvent: { altKey, ctrlKey, key, metaKey, shiftKey } } = event;
            if (MODIFIER_KEYS.has(key)) return;

            const keys: string[] = [];
            if (metaKey) keys.push("META");
            if (ctrlKey) keys.push(IS_MAC ? "CONTROL" : "CTRL");
            if (shiftKey) keys.push("SHIFT");
            if (altKey) keys.push("ALT");

            let mainKey = key.toUpperCase();
            if (mainKey === " ") mainKey = "SPACE";
            if (mainKey === "ESCAPE") mainKey = "ESC";
            keys.push(mainKey);

            const normalized = normalizeKeybindForComparison(keys);
            const currentStore = getStore();

            for (const otherFormat of formats) {
                if (otherFormat.settingKey === format.settingKey) continue;
                const maybeOtherKeys = currentStore[otherFormat.settingKey];
                const otherKeys = Array.isArray(maybeOtherKeys) ? maybeOtherKeys : [];
                if (otherKeys.length && normalizeKeybindForComparison(otherKeys) === normalized) {
                    setError(`Already used by: ${otherFormat.name}`);
                    setTimeout(() => setError(null), 3000);
                    setIsListening(false);
                    return;
                }
            }

            if (DISCORD_BUILTIN_SHORTCUTS.includes(normalized)) {
                logger.warn(`Shortcut for ${format.name} may conflict with a Discord built-in shortcut.`);
            }

            currentStore[format.settingKey] = keys;
            setError(null);
            setIsListening(false);
        };

        const handleClear = () => {
            getStore()[format.settingKey] = [];
            setError(null);
        };

        return (
            <div
                className={cl("keybind-row")}
                style={{
                    opacity: isShortcutsEnabled ? 1 : 0.4,
                    pointerEvents: isShortcutsEnabled ? "auto" : "none"
                }}
            >
                <div className={cl("keybind-info")}>
                    <span className={cl("keybind-label")}>{format.name}</span>
                    {error && (
                        <span className={cl("keybind-conflict")}>{error}</span>
                    )}
                </div>
                <div className={cl("keybind-controls")}>
                    <button
                        ref={recordButtonRef}
                        type="button"
                        className={cl("keybind-button", isListening ? "listening" : "")}
                        onClick={() => setIsListening(true)}
                        onKeyDown={handleRecord}
                        onBlur={() => setIsListening(false)}
                    >
                        {isListening ? "Press a key..." : formatKeybindDisplay(currentKeybind)}
                    </button>
                    <Button
                        size="small"
                        variant="secondary"
                        onClick={handleClear}
                    >
                        Clear
                    </Button>
                </div>
            </div>
        );
    };
}
