/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./Badge.css";

import { classNameFactory } from "@utils/css";
import { classes } from "@utils/misc";
import type { ComponentPropsWithoutRef, ComponentType, CSSProperties, ReactNode, SVGProps } from "react";

const cl = classNameFactory("vc-badge-");

export const BadgeVariants = ["default", "expressive", "danger", "positive", "warning", "premium"] as const;

export type BadgeVariant = typeof BadgeVariants[number];

export type BadgeProps = Omit<ComponentPropsWithoutRef<"div">, "children"> & {
    text: ReactNode;
    variant?: BadgeVariant;
    icon?: ComponentType<SVGProps<SVGSVGElement> & { size?: string; }>;
    color?: string;
    backgroundColor?: string;
};

export function Badge({ text, variant = "default", icon: Icon, className, color, backgroundColor, style, ...restProps }: BadgeProps) {
    const customStyle: CSSProperties | undefined = (color || backgroundColor) ? {
        ...style,
        ...(color && { color }),
        ...(backgroundColor && { backgroundColor })
    } : style;

    return (
        <div className={classes(cl("base", variant), className)} style={customStyle} {...restProps}>
            {Icon && <Icon size="xxs" className={cl("icon")} />}
            {text}
        </div>
    );
}
