/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { GuildMemberStore, RestAPI } from "@webpack/common";

import { ExporterFunc } from "./types";
import { removeNullValues, sleep } from "./utils";

export const exportMembers: ExporterFunc = async ctx => {
    ctx.setProgress("Exporting members...");
    // Try to get members from store first
    let members = GuildMemberStore.getMembers(ctx.guildId);

    if (!members || members.length <= 1) { // 1 might just be the current user
        ctx.logger.info("Members not found or incomplete in store, fetching from API...");
        try {
            // Discord's internal RestAPI usually needs the full path or it handles prefixes
            // We'll try the most likely path
            const resp = await RestAPI.get({
                url: `/guilds/${ctx.guildId}/members`,
                query: { limit: 1000 }
            });

            if (resp.ok && Array.isArray(resp.body)) {
                members = resp.body;
            } else if (resp.ok && resp.body?.members) {
                 members = resp.body.members;
            }
        } catch (e) {
            ctx.logger.error("Failed to fetch members from API", e);
        }
    }

    const memberList = members || [];
    ctx.logger.info(`Found ${memberList.length} members`);
    await ctx.save("members.json", JSON.stringify(removeNullValues(memberList), null, 2));

    await sleep(ctx.actionDelay);
};
