/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { ReactNode } from "react";

interface PaletteFieldProps {
    label: string;
    children: ReactNode;
}

export function PaletteField({ label, children }: PaletteFieldProps) {
    return (
        <div className="vc-command-palette-page-field">
            <label className="vc-command-palette-page-field-label">{label}</label>
            {children}
        </div>
    );
}
