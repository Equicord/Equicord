/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./FormGenericLabel.css";

import { Divider } from "@components/Divider";
import { Span } from "@components/Span";
import { classNameFactory } from "@utils/css";
import { classes } from "@utils/misc";
import type { ReactNode } from "react";

import { cl as pluginCl } from "..";

const cl = classNameFactory("vc-keywordnotify-form-generic-label-");

interface FormGenericLabelProps {
    title: ReactNode;
    description?: ReactNode;

    className?: string;
    disabled?: boolean;
    hideBorder?: boolean;

    children: ReactNode;
}

export function FormGenericLabel({ title, description, disabled, className, hideBorder, children }: FormGenericLabelProps) {
    return (
        <label className={cl("wrapper")}>
            <div className={classes(pluginCl("form-generic-label"), className, disabled && cl("disabled"))}>
                <div className={cl("text")}>
                    <Span size="md" weight="medium">{title}</Span>
                    {description && <Span size="sm" weight="normal">{description}</Span>}
                </div>

                {children}
            </div>
            {!hideBorder && <Divider className={cl("border")} />}
        </label>
    );
}
