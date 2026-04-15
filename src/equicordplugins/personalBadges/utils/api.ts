/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IPersonalBadge } from "../types";
import { defineProfileBadge } from "./badge";
import { BadgeHandler } from "./badge/data";


export function removeBadge(c_id: string, b_id: string): IPersonalBadge | undefined {
    const badge = BadgeHandler.getCache().get(c_id)?.badges?.find(x => x.id === b_id);
    if (!badge) return undefined;

    Vencord.Api.Badges.removeProfileBadge(defineProfileBadge(badge.profileBadge));
    return badge;
}

export function addBadge(c_id: string, b_id: string): IPersonalBadge | undefined {
    const badge = BadgeHandler.getCache().get(c_id)?.badges?.find(x => x.id === b_id);
    if (!badge) return undefined;

    Vencord.Api.Badges.addProfileBadge(defineProfileBadge(badge.profileBadge));
    return badge;
}
