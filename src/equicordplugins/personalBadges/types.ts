/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ProfileBadge } from "@api/Badges";

export interface IPersonalBadge {
    id: string,
    c_id: string,

    image?: string,
    tooltip?: string,
    link?: string,
    position?: string,
    squircle: boolean,
    global: boolean,

    excluded?: string[],
    users?: string[],
    guilds?: string[];
    profileBadge?: ProfileBadge;
    // path?: string
}

export interface IPBadgeCategory {
    id: string,
    icon?: string,
    name: string,

    badges?: IPersonalBadge[];
}
