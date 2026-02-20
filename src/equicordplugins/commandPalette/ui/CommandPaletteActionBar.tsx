/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EquicordIcon } from "@equicordplugins/components.dev/components/icons/EquicordIcon";

interface CommandPaletteActionBarProps {
    selectedLabel?: string;
    onOpenActions?(): void;
    compact?: boolean;
    onExpand?(): void;
}

export function CommandPaletteActionBar({ selectedLabel, onOpenActions, compact, onExpand }: CommandPaletteActionBarProps) {
    if (compact) {
        return (
            <div className="vc-command-palette-action-bar">
                <div className="vc-command-palette-action-bar-label vc-command-palette-action-bar-logo">
                    <EquicordIcon />
                </div>
                <button
                    type="button"
                    className="vc-command-palette-action-bar-compact-btn"
                    onClick={onExpand}
                >
                    <span className="vc-command-palette-action-bar-actions-label">Show More</span>
                    <span>↓</span>
                </button>
            </div>
        );
    }

    return (
        <div className="vc-command-palette-action-bar">
            <div className="vc-command-palette-action-bar-label">
                {selectedLabel ? (
                    <span className="vc-command-palette-row-subtitle">{selectedLabel}</span>
                ) : (
                    <span className="vc-command-palette-action-bar-placeholder">No selection</span>
                )}
            </div>
            <button
                type="button"
                className="vc-command-palette-action-bar-actions-button"
                onClick={onOpenActions}
            >
                <span className="vc-command-palette-action-bar-actions-label">Actions</span>
                <span className="vc-command-palette-action-bar-key">⌘L</span>
            </button>
        </div>
    );
}
