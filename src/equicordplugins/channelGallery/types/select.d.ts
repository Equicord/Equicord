/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface ManaSelectOption {
    id: string;
    value: string;
    label: string;
}

export interface ManaSelectProps {
    value: string;
    onSelectionChange: (value: string) => void;
    options: ManaSelectOption[];
    selectionMode?: "single" | "multiple";
    closeOnSelect?: boolean;
    fullWidth?: boolean;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
}
