/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BadgePosition, ProfileBadge } from "@api/Badges";

import { IPersonalBadge } from "../../types";
import { DEFAULT_BADGE_URL, GITHUB_URL } from "../constants";


export function isExcluded(userId: string, badge: IPersonalBadge): boolean {
    return !badge.excluded?.includes(userId);
}

export function defineProfileBadge(profileBadge: ProfileBadge | undefined): ProfileBadge {
    return profileBadge ?? {};
}

export function defineLink(link: string | undefined): string {
    return !link || link.trim() === "" ? GITHUB_URL : link;
}

export function defineImage(image: string | undefined): string {
    return !image || image.trim() === "" ? DEFAULT_BADGE_URL : image;
}

export function defineTooltip(tooltip: string | undefined): string | undefined {
    return !tooltip || tooltip.trim() === "" ? undefined : tooltip;
}

export function definePosition(position: string | undefined): BadgePosition {
    const upper = position?.toUpperCase();
    return upper === "START" ? BadgePosition.START : (upper === "END" ? BadgePosition.END : BadgePosition.START);
}

export function defineInclusion(userId: string, guildId: string, badge: IPersonalBadge): boolean {
    const excluded = isExcluded(userId, badge);
    return badge.global ? excluded : (badge.guilds?.includes(guildId) ? excluded : (badge.users?.includes(userId) ? excluded : false));
}

export function defineStyleProps(squircle: boolean) {
    return {
        borderRadius: squircle ? "30%" : "50%",
        transform: "scale(0.9)"
    };
}

export function iPersonalToProfile(i: IPersonalBadge): ProfileBadge {
    return {
        iconSrc: defineImage(i.image),
        description: defineTooltip(i.tooltip),
        position: definePosition(i.position),
        link: defineLink(i.link),
        shouldShow: ({ userId, guildId }) => defineInclusion(userId, guildId, i),
        props: { style: defineStyleProps(i.squircle) }
    };
}


export * from "./manage";
