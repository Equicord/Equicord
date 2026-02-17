/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { AvatarSize, AvatarStatus } from "../constants";

export type { AvatarSize, AvatarStatus };

export interface AvatarSizeConfig {
    size: number;
    status: number;
    stroke: number;
    offset: number;
}

export interface AvatarProps {
    src?: string;
    size?: AvatarSize;
    status?: AvatarStatus;
    statusColor?: string;
    statusBackdropColor?: string;
    isMobile?: boolean;
    isVR?: boolean;
    isTyping?: boolean;
    isSpeaking?: boolean;
    isLatched?: boolean;
    voiceDb?: number;
    speakingStylesConfig?: Record<string, any>;
    statusTooltip?: boolean;
    statusTooltipDelay?: number;
    typingIndicatorRef?: React.Ref<any>;
    avatarContentRef?: React.Ref<any>;
    CutoutIcon?: React.ComponentType<any>;
    avatarTooltipAsset?: React.ReactNode;
    avatarTooltipText?: string;
    avatarTooltipTitle?: string;
    avatarDecoration?: string;
    "aria-hidden"?: boolean;
    "aria-label"?: string;
    imageClassName?: string;
    className?: string;
    onClick?: React.MouseEventHandler<HTMLElement>;
    onMouseDown?: React.MouseEventHandler<HTMLElement>;
    onKeyDown?: React.KeyboardEventHandler<HTMLElement>;
    onContextMenu?: React.MouseEventHandler<HTMLElement>;
    onMouseEnter?: React.MouseEventHandler<HTMLElement>;
    onMouseLeave?: React.MouseEventHandler<HTMLElement>;
    tabIndex?: number;
    ref?: React.Ref<SVGSVGElement>;
}
