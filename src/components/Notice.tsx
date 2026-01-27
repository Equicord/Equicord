/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./Notice.css";

import { classNameFactory } from "@utils/css";
import { classes } from "@utils/misc";
import type { ComponentPropsWithoutRef, ComponentType, ReactNode, SVGProps } from "react";

const cl = classNameFactory("vc-notice-");

export const NoticeVariants = ["info", "warning", "danger", "positive"] as const;

export type NoticeVariant = typeof NoticeVariants[number];

export type NoticeProps = Omit<ComponentPropsWithoutRef<"div">, "children"> & {
    children: ReactNode;
    variant?: NoticeVariant;
    icon?: ComponentType<SVGProps<SVGSVGElement>>;
    action?: ReactNode;
    hidden?: boolean;
};

function InfoIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" {...props}>
            <path fill="currentColor" fillRule="evenodd" d="M23 12a11 11 0 1 1-22 0 11 11 0 0 1 22 0Zm-9.5-4.75a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Zm-.77 3.96a1 1 0 1 0-1.96-.42l-1.04 4.86a2.77 2.77 0 0 0 4.31 2.83l.24-.17a1 1 0 1 0-1.16-1.62l-.24.17a.77.77 0 0 1-1.2-.79l1.05-4.86Z" clipRule="evenodd" />
        </svg>
    );
}

function WarningIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" {...props}>
            <path fill="currentColor" fillRule="evenodd" d="M10 3.1a2.37 2.37 0 0 1 4 0l8.71 14.75c.84 1.41-.26 3.15-2 3.15H3.29c-1.74 0-2.84-1.74-2-3.15L9.99 3.1Zm3.25 14.65a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0ZM13.06 14l.37-5.94a1 1 0 0 0-1-1.06h-.87a1 1 0 0 0-1 1.06l.38 5.94a1.06 1.06 0 0 0 2.12 0Z" clipRule="evenodd" />
        </svg>
    );
}

function DangerIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" {...props}>
            <path fill="currentColor" fillRule="evenodd" d="M12 23a11 11 0 1 0 0-22 11 11 0 0 0 0 22Zm4.7-15.7a1 1 0 0 0-1.4 0L12 10.58l-3.3-3.3a1 1 0 0 0-1.4 1.42L10.58 12l-3.3 3.3a1 1 0 1 0 1.42 1.4L12 13.42l3.3 3.3a1 1 0 0 0 1.4-1.42L13.42 12l3.3-3.3a1 1 0 0 0 0-1.4Z" clipRule="evenodd" />
        </svg>
    );
}

function PositiveIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" {...props}>
            <path fill="currentColor" fillRule="evenodd" d="M12 23a11 11 0 1 0 0-22 11 11 0 0 0 0 22Zm5.7-13.3a1 1 0 0 0-1.4-1.4L10 14.58l-2.3-2.3a1 1 0 0 0-1.4 1.42l3 3a1 1 0 0 0 1.4 0l7-7Z" clipRule="evenodd" />
        </svg>
    );
}

const DefaultIcons: Record<NoticeVariant, ComponentType<SVGProps<SVGSVGElement>>> = {
    info: InfoIcon,
    warning: WarningIcon,
    danger: DangerIcon,
    positive: PositiveIcon
};

export function Notice({ children, variant = "info", icon, action, hidden = false, className, ...restProps }: NoticeProps) {
    const Icon = icon ?? DefaultIcons[variant];

    return (
        <div className={classes(cl("container", variant), hidden && cl("hidden"), className)} {...restProps}>
            <div className={cl("inner")}>
                <div className={cl("icon-wrapper")}>
                    <Icon className={cl("icon")} />
                </div>
                <div className={cl("text")}>
                    {children}
                </div>
                {action && (
                    <div className={cl("action")}>
                        {action}
                    </div>
                )}
            </div>
        </div>
    );
}

Notice.Info = (props: Omit<NoticeProps, "variant">) => <Notice variant="info" {...props} />;
Notice.Warning = (props: Omit<NoticeProps, "variant">) => <Notice variant="warning" {...props} />;
Notice.Danger = (props: Omit<NoticeProps, "variant">) => <Notice variant="danger" {...props} />;
Notice.Positive = (props: Omit<NoticeProps, "variant">) => <Notice variant="positive" {...props} />;
