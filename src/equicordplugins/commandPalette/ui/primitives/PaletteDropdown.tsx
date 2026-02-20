/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { PaletteSuggestion } from "../pages/types";

interface PaletteDropdownProps {
    suggestions: PaletteSuggestion[];
    highlightedIndex: number;
    className?: string;
    onPick(suggestion: PaletteSuggestion): void;
    onHover(index: number): void;
}

export function PaletteDropdown({ suggestions, highlightedIndex, className, onPick, onHover }: PaletteDropdownProps) {
    if (suggestions.length === 0) return null;

    return (
        <div className={className ? `vc-command-palette-dropdown ${className}` : "vc-command-palette-dropdown"}>
            <div className="vc-command-palette-dropdown-list">
                {suggestions.map((suggestion, index) => {
                    const selected = index === highlightedIndex;
                    return (
                        <button
                            key={suggestion.id}
                            type="button"
                            className={selected ? "vc-command-palette-dropdown-item vc-command-palette-dropdown-item-selected" : "vc-command-palette-dropdown-item"}
                            onMouseDown={event => {
                                event.preventDefault();
                                onPick(suggestion);
                            }}
                            onClick={() => onPick(suggestion)}
                            onMouseEnter={() => onHover(index)}
                        >
                            <span className="vc-command-palette-dropdown-icon">
                                {suggestion.iconUrl ? (
                                    <img src={suggestion.iconUrl} alt="" />
                                ) : (
                                    <span className="vc-command-palette-dropdown-icon-fallback">
                                        {suggestion.kind === "channel"
                                            ? "#"
                                            : suggestion.kind === "guild"
                                                ? "G"
                                                : suggestion.kind === "user"
                                                    ? "@"
                                                    : "•"}
                                    </span>
                                )}
                            </span>
                            <span className="vc-command-palette-dropdown-label">{suggestion.label}</span>
                            {suggestion.sublabel && (
                                <span className="vc-command-palette-dropdown-sublabel">{suggestion.sublabel}</span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
