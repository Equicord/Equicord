/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface BadgeShapesType {
    ROUND: string;
    ROUND_LEFT: string;
    ROUND_RIGHT: string;
    SQUARE: string;
}

export interface NumberBadgeProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
    count: number;
    color?: string;
    disableColor?: boolean;
    shape?: string;
    className?: string;
    style?: React.CSSProperties;
    renderBadgeCount?: (count: number) => string;
}

export interface TextBadgeProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
    text: string;
    color?: string;
    disableColor?: boolean;
    shape?: string;
    className?: string;
    style?: React.CSSProperties;
}

export interface IconBadgeProps {
    icon: React.ComponentType<{ className?: string; color?: string; }>;
    color?: string;
    disableColor?: boolean;
    shape?: string;
    className?: string;
    style?: React.CSSProperties;
}

export interface CircleBadgeProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
    color?: string;
    disableColor?: boolean;
    shape?: string;
    className?: string;
    style?: React.CSSProperties;
}

export interface PremiumBadgeProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
    text: string;
    className?: string;
    color?: string;
    disableColor?: boolean;
    shape?: string;
    style?: React.CSSProperties;
}
