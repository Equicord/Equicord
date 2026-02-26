/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export type ProgressBarVariant = "blue" | "orange" | "unset";

export interface ProgressBarOverride {
    background?: string;
    gradientStart?: string;
    gradientEnd?: string;
}

export type ProgressBarWeight = "light" | "medium";

export interface ProgressBarProps {
    progress: number;
    minimum?: number;
    maximum?: number;
    weight?: ProgressBarWeight;
    variant?: ProgressBarVariant;
    override?: {
        default?: ProgressBarOverride;
        [key: string]: ProgressBarOverride | undefined;
    };
    glowing?: boolean;
    labelledBy?: string;
}
