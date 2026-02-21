/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { TextInput } from "@webpack/common";
import type { KeyboardEvent } from "react";

import type { PaletteSuggestion } from "../pages/types";
import { PaletteDropdown } from "./PaletteDropdown";
import { usePaletteDropdown } from "./usePaletteDropdown";

interface PalettePickerInputProps {
    value: string;
    suggestions: PaletteSuggestion[];
    placeholder?: string;
    className?: string;
    onChange(value: string): void;
    onPick(suggestion: PaletteSuggestion): void;
}

export function PalettePickerInput({
    value,
    suggestions,
    placeholder,
    className,
    onChange,
    onPick
}: PalettePickerInputProps) {
    const dropdown = usePaletteDropdown(suggestions);

    const handlePick = (suggestion: PaletteSuggestion) => {
        dropdown.setIsOpen(false);
        dropdown.reset();
        onPick(suggestion);
    };

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if ((event.key === "ArrowDown" || event.key === "ArrowUp") && suggestions.length > 0) {
            event.preventDefault();
            dropdown.setIsOpen(true);
            dropdown.moveHighlight(event.key === "ArrowDown" ? 1 : -1);
            return;
        }

        if (event.key === "Enter" && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey) {
            const candidate = suggestions[dropdown.highlightIndex] ?? suggestions[0];
            if (!candidate) return;
            event.preventDefault();
            handlePick(candidate);
            return;
        }

        if (event.key === "Escape") {
            dropdown.setIsOpen(false);
            dropdown.reset();
        }
    };

    return (
        <div className={className ? `vc-command-palette-page-picker ${className}` : "vc-command-palette-page-picker"}>
            <TextInput
                className="vc-command-palette-page-input"
                value={value}
                placeholder={placeholder}
                onChange={next => {
                    onChange(next);
                    dropdown.setIsOpen(true);
                }}
                onFocus={() => dropdown.setIsOpen(true)}
                onBlur={() => {
                    window.setTimeout(() => {
                        dropdown.setIsOpen(false);
                    }, 0);
                }}
                onKeyDown={onKeyDown}
            />
            {dropdown.isOpen && suggestions.length > 0 && (
                <PaletteDropdown
                    suggestions={suggestions}
                    highlightedIndex={dropdown.highlightIndex}
                    onHover={dropdown.setHighlightIndex}
                    onPick={handlePick}
                />
            )}
        </div>
    );
}
