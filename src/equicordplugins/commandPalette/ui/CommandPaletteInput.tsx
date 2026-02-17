/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { TextInput } from "@webpack/common";
import type { ReactNode } from "react";

interface CommandPaletteInputProps {
    value: string;
    onChange(value: string): void;
    compact?: boolean;
    placeholder?: string;
    autoFocus?: boolean;
    hideMainInput?: boolean;
    children?: ReactNode;
}

export function CommandPaletteInput({ value, onChange, placeholder, autoFocus = true, hideMainInput = false, children }: CommandPaletteInputProps) {
    return (
        <div className="vc-command-palette-input">
            {!hideMainInput && (
                <div className="vc-command-palette-main-input">
                    <TextInput
                        className="vc-command-palette-main-search-input"
                        autoFocus={autoFocus}
                        value={value}
                        onChange={onChange}
                        placeholder={placeholder ?? "Search commands or type a query"}
                    />
                </div>
            )}
            {children}
        </div>
    );
}
