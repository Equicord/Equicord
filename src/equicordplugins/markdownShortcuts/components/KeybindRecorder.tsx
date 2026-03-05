/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { IS_MAC } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { Logger } from "@utils/Logger";
import { useEffect, useState } from "@webpack/common";

import { MarkdownFormat } from "../types";
import { DISCORD_BUILTIN_SHORTCUTS, formatKeybindDisplay, MODIFIER_KEYS, normalizeKeybindForComparison } from "../utils";

const cl = classNameFactory("vc-mdshortcuts-");
const logger = new Logger("MarkdownShortcuts");

export function createKeybindRecorderComponent(
    format: MarkdownFormat,
    FORMATS: MarkdownFormat[],
    getStore: () => Record<string, any>
) {
    return function KeybindRecorderForFormat() {
        const [isListening, setIsListening] = useState(false);
        const [error, setError] = useState<string | null>(null);
        const store = getStore();
        const isShortcutsEnabled = store.enableShortcuts;

        let currentKeybind: string[] = store[format.settingKey];
        if (!Array.isArray(currentKeybind)) {
            currentKeybind = format.defaultKeybind || [];
        }

        useEffect(() => {
            if (!isListening) return;

            const handleKeyDown = (event: KeyboardEvent) => {
                event.preventDefault();
                event.stopPropagation();

                if (MODIFIER_KEYS.has(event.key)) return;

                const keys: string[] = [];
                if (event.metaKey) keys.push("META");
                if (event.ctrlKey) keys.push(IS_MAC ? "CONTROL" : "CTRL");
                if (event.shiftKey) keys.push("SHIFT");
                if (event.altKey) keys.push("ALT");

                let mainKey = event.key.toUpperCase();
                if (mainKey === " ") mainKey = "SPACE";
                if (mainKey === "ESCAPE") mainKey = "ESC";
                keys.push(mainKey);

                const normalized = normalizeKeybindForComparison(keys);
                const currentStore = getStore();

                for (const otherFormat of FORMATS) {
                    if (otherFormat.settingKey === format.settingKey) continue;
                    const otherKeys: string[] = currentStore[otherFormat.settingKey] ?? [];
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

            const handleBlur = () => setIsListening(false);

            document.addEventListener("keydown", handleKeyDown, true);
            window.addEventListener("blur", handleBlur);

            return () => {
                document.removeEventListener("keydown", handleKeyDown, true);
                window.removeEventListener("blur", handleBlur);
            };
        }, [isListening]);

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
                        type="button"
                        className={cl("keybind-button", isListening ? "listening" : "")}
                        onClick={() => setIsListening(true)}
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
