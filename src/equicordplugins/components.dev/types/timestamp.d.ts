/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Moment } from "moment";

export type TimestampFormat = "LT" | "LTS" | "L" | "LL" | "LLL" | "LLLL" | "l" | "ll" | "lll" | "llll";

export type TooltipPosition = "top" | "bottom" | "left" | "right";

export interface TimestampProps {
    timestamp: Date | Moment;
    timestampFormat?: TimestampFormat;
    compact?: boolean;
    cozyAlt?: boolean;
    isInline?: boolean;
    isVisibleOnlyOnHover?: boolean;
    isEdited?: boolean;
    id?: string;
    className?: string;
    children?: React.ReactNode;
    tooltipPosition?: TooltipPosition;
}
