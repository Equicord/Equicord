/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface CustomStatus {
    text?: string;
    emojiId?: string;
    emojiName?: string;
    expiresAtMs?: string;
}

export interface ProfileEffect {
    skuId: string;
    title?: string;
    description?: string;
    accessibilityLabel?: string;
    reducedMotionSrc?: string;
    thumbnailPreviewSrc?: string;
    effects?: any[];
    animationType?: number;
    staticFrameSrc?: string;
    type?: number;
}

export interface Nameplate {
    skuId: string;
    asset: string;
    label?: string;
    palette?: string;
    type?: number;
}

export interface DisplayNameStyles {
    fontId: number;
    effectId: number;
    colors: number[];
}

export interface ProfilePreset {
    name: string;
    timestamp: number;
    avatarDataUrl?: string | null;
    bannerDataUrl?: string | null;
    bio?: string | null;
    accentColor?: number | null;
    themeColors?: number[] | null;
    globalName?: string | null;
    pronouns?: string | null;
    avatarDecoration?: {
        asset: string;
        skuId: string;
    } | null;
    profileEffect?: ProfileEffect | null;
    nameplate?: Nameplate | null;
    primaryGuildId?: string | null;
    customStatus?: CustomStatus | null;
    displayNameStyles?: DisplayNameStyles | null;
}