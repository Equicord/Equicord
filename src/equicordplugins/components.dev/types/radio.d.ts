/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface RadioOption {
    value: string | number;
    name: string;
    description?: string;
    disabled?: boolean;
    icon?: React.ComponentType<{ className?: string; size?: string; color?: string; }>;
    color?: string;
    radioItemIconClassName?: string;
    radioBarClassName?: string;
}

export type RadioPosition = "left" | "right";

export interface ManaBaseRadioGroupProps {
    options: RadioOption[];
    value?: string | number | null;
    onChange?: (value: string | number) => void;
    disabled?: boolean;
    size?: string;
    orientation?: "vertical" | "horizontal";
    radioPosition?: RadioPosition;
    withTransparentBackground?: boolean;
    label?: string;
    description?: string;
    required?: boolean;
    errorMessage?: string;
    "aria-labelledby"?: string;
    className?: string;
    itemInfoClassName?: string;
    itemTitleClassName?: string;
    radioItemClassName?: string;
    collapsibleClassName?: string;
}

export interface StandaloneRadioIndicatorProps {
    isSelected: boolean;
    disabled?: boolean;
}
