/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Guild, User } from "discord-types/general";

import { PluginLogger } from "../../utils/constants";
import { BadgeHandler } from "./data";


export async function excludeBadge(user: User, c_id: string, b_id: string): Promise<boolean> {
    try {
        const category = BadgeHandler.getCache().get(c_id);
        if (!category) return false;

        const badge = category.badges?.find(x => x.id === b_id);
        if (!badge) return false;

        const wasIncluded: boolean = badge.users?.includes(user.id) ? badge.users.splice(badge.users.indexOf(user.id), 1).length > 0 : false;

        if (!badge.excluded) badge.excluded = [user.id];
        else if (!badge.excluded.includes(user.id)) badge.excluded.push(user.id);
        else if (!wasIncluded) return false;

        await BadgeHandler.update(c_id, badge);
        return true;
    } catch (error) {
        PluginLogger.error(error);
        return false;
    }
}

export async function includeBadge(user: User, c_id: string, b_id: string): Promise<boolean> {
    try {
        const category = BadgeHandler.getCache().get(c_id);
        if (!category) return false;

        const badge = category.badges?.find(x => x.id === b_id);
        if (!badge) return false;

        const wasExcluded: boolean = badge.excluded?.includes(user.id) ? badge.excluded.splice(badge.excluded.indexOf(user.id), 1).length > 0 : false;

        if (badge.global) {
            if (wasExcluded) {
                BadgeHandler.update(c_id, badge);
                return true;
            }
            return false;
        }

        if (!badge.users) badge.users = [user.id];
        else if (!badge.users.includes(user.id)) badge.users.push(user.id);
        else if (!wasExcluded) return false;

        await BadgeHandler.update(c_id, badge);
        return true;
    } catch (error) {
        PluginLogger.error(error);
        return false;
    }
}


export async function excludeGuildBadge(guild: Guild, c_id: string, b_id: string): Promise<boolean> {
    try {
        const category = BadgeHandler.getCache().get(c_id);
        if (!category) return false;

        const badge = category.badges?.find(x => x.id === b_id);
        if (!badge) return false;

        if (!badge.guilds) badge.guilds = [guild.id];
        else if (badge.guilds.includes(guild.id)) badge.guilds.splice(badge.guilds.indexOf(guild.id), 1);
        else return false;

        await BadgeHandler.update(c_id, badge);
        return true;
    } catch (error) {
        PluginLogger.error(error);
        return false;
    }
}

export async function includeGuildBadge(guild: Guild, c_id: string, b_id: string): Promise<boolean> {
    try {
        const category = BadgeHandler.getCache().get(c_id);
        if (!category) return false;

        const badge = category.badges?.find(x => x.id === b_id);
        if (!badge) return false;

        if (!badge.guilds) badge.guilds = [guild.id];
        else if (!badge.guilds.includes(guild.id)) badge.guilds.push(guild.id);
        else return false;

        await BadgeHandler.update(c_id, badge);
        return true;
    } catch (error) {
        PluginLogger.error(error);
        return false;
    }
}
