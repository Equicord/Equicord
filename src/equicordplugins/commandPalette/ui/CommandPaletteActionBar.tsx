/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

interface CommandPaletteActionBarProps {
    selectedLabel?: string;
    onOpenActions?(): void;
}

export function CommandPaletteActionBar({ selectedLabel, onOpenActions }: CommandPaletteActionBarProps) {
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
