/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Constants, GuildRoleStore, RestAPI } from "@webpack/common";

import { ExporterFunc } from "./types";
import { removeNullValues, sleep } from "./utils";

export const exportRoles: ExporterFunc = async ctx => {
    ctx.setProgress("Exporting roles...");
    const roles = GuildRoleStore.getRolesSnapshot(ctx.guildId) || [];
    await ctx.save("roles.json", JSON.stringify(removeNullValues(roles), null, 2));
    await sleep(ctx.actionDelay);
};

export const exportAutomod: ExporterFunc = async ctx => {
    ctx.setProgress("Exporting automod rules...");
    try {
        const automodRules = await RestAPI.get({
            url: (Constants.Endpoints as any).GUILD_AUTOMOD_RULES(ctx.guildId)
        });
        if (automodRules.ok) {
            await ctx.save("automod.json", JSON.stringify(removeNullValues(automodRules.body), null, 2));
        }
    } catch (e) {
        ctx.logger.warn("Failed to fetch automod rules", e);
    }
    await sleep(ctx.actionDelay);
};
