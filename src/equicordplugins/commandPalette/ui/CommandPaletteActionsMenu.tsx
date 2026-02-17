/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { CogWheel } from "@components/Icons";
import { TextInput, useCallback, useEffect, useMemo, useRef, useState } from "@webpack/common";
import type { KeyboardEvent } from "react";

export interface PaletteAction {
    id: string;
    label: string;
    shortcut: string;
    icon?: React.ComponentType<{ className?: string; size?: string; }>;
    handler(): void;
}

interface CommandPaletteActionsMenuProps {
    actions: PaletteAction[];
    title?: string;
    onClose(): void;
}

function parseShortcut(shortcut: string): string[] {
    if (!shortcut) return [];
    const keys: string[] = [];
    const remaining = shortcut;
    const specialKeys: { [key: string]: string } = {
        "⌘": "⌘",
        "⌥": "⌥",
        "⇧": "⇧",
        "⌃": "⌃",
        "↵": "↵",
        "←": "←",
        "→": "→",
        "↑": "↑",
        "↓": "↓",
        "Tab": "Tab",
        "Esc": "Esc",
        "Space": "Space"
    };

    for (let i = 0; i < remaining.length; i++) {
        const char = remaining[i];
        if (specialKeys[char]) {
            keys.push(specialKeys[char]);
        } else if (char.match(/[a-zA-Z0-9]/)) {
            keys.push(char.toUpperCase());
        }
    }

    return keys.length > 0 ? keys : [shortcut];
}

export function CommandPaletteActionsMenu({ actions, title, onClose }: CommandPaletteActionsMenuProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const actionRefs = useRef<Array<HTMLButtonElement | null>>([]);

    const filteredActions = useMemo(() => {
        if (!searchQuery.trim()) return actions;
        const query = searchQuery.toLowerCase();
        return actions.filter(action =>
            action.label.toLowerCase().includes(query)
        );
    }, [actions, searchQuery]);

    useEffect(() => {
        setSelectedIndex(0);
    }, [searchQuery]);

    useEffect(() => {
        searchInputRef.current?.focus();
    }, []);

    useEffect(() => {
        const element = actionRefs.current[selectedIndex];
        if (element) {
            element.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
    }, [selectedIndex]);

    const handleActionClick = useCallback((action: PaletteAction) => {
        action.handler();
        onClose();
    }, [onClose]);

    const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Escape") {
            event.preventDefault();
            if (searchQuery) {
                setSearchQuery("");
            } else {
                onClose();
            }
            return;
        }

        if (event.key === "ArrowDown") {
            event.preventDefault();
            setSelectedIndex(prev => (prev + 1) % filteredActions.length);
            return;
        }

        if (event.key === "ArrowUp") {
            event.preventDefault();
            setSelectedIndex(prev => (prev - 1 + filteredActions.length) % filteredActions.length);
            return;
        }

        if (event.key === "Enter") {
            event.preventDefault();
            const action = filteredActions[selectedIndex];
            if (action) {
                handleActionClick(action);
            }
            return;
        }
    }, [filteredActions, selectedIndex, handleActionClick, onClose, searchQuery]);

    return (
        <div
            ref={containerRef}
            className="vc-command-palette-actions-dropdown"
            onKeyDown={handleKeyDown}
            tabIndex={-1}
        >
            {title && (
                <div className="vc-command-palette-actions-dropdown-header">
                    <span className="vc-command-palette-actions-dropdown-title">{title}</span>
                </div>
            )}

            <div className="vc-command-palette-actions-dropdown-list">
                {filteredActions.length === 0 ? (
                    <div className="vc-command-palette-actions-dropdown-empty">
                        No actions found
                    </div>
                ) : (
                    filteredActions.map((action, index) => {
                        const Icon = action.icon ?? CogWheel;
                        const isSelected = index === selectedIndex;
                        const shortcutKeys = parseShortcut(action.shortcut);

                        return (
                            <button
                                key={action.id}
                                ref={el => { actionRefs.current[index] = el; }}
                                type="button"
                                className={isSelected
                                    ? "vc-command-palette-action-dropdown-item vc-command-palette-action-dropdown-item-selected"
                                    : "vc-command-palette-action-dropdown-item"}
                                onClick={() => handleActionClick(action)}
                                onMouseEnter={() => setSelectedIndex(index)}
                            >
                                <div className="vc-command-palette-action-dropdown-icon">
                                    <Icon size="18" />
                                </div>
                                <span className="vc-command-palette-action-dropdown-label">{action.label}</span>
                                <div className="vc-command-palette-action-dropdown-shortcuts">
                                    {shortcutKeys.map((key, keyIndex) => (
                                        <kbd key={keyIndex} className="vc-command-palette-action-dropdown-key">
                                            {key}
                                        </kbd>
                                    ))}
                                </div>
                            </button>
                        );
                    })
                )}
            </div>

            <div className="vc-command-palette-actions-dropdown-search">
                <TextInput
                    inputRef={searchInputRef}
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Search for actions..."
                    className="vc-command-palette-actions-search-input"
                />
            </div>
        </div>
    );
}
