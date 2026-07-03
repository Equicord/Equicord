/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { classNameFactory } from "@utils/css";

import type { PaletteIcon as PaletteIconType } from "../api/types";

const cl = classNameFactory("vc-cmdpal-");

interface PaletteIconRenderProps {
    icon?: PaletteIconType;
    className?: string;
}

export function PaletteIcon({ icon, className }: PaletteIconRenderProps) {
    if (!icon) return null;
    if (typeof icon === "string") {
        return <img className={className ?? cl("icon")} src={icon} alt="" />;
    }
    const Icon = icon;
    return <Icon className={className ?? cl("icon")} />;
}
