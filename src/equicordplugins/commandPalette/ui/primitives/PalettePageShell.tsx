/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { ReactNode } from "react";

interface PalettePageShellProps {
    title?: string;
    children: ReactNode;
    error?: string | null;
}

export function PalettePageShell({ title, children, error }: PalettePageShellProps) {
    return (
        <div className="vc-command-palette-page">
            {title && (
                <div className="vc-command-palette-page-title">{title}</div>
            )}
            <div className="vc-command-palette-page-content">
                {children}
            </div>
            {error && (
                <div className="vc-command-palette-page-error">{error}</div>
            )}
        </div>
    );
}
