/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { RestAPI } from "@webpack/common";

import { ExporterFunc } from "./types";
import { removeNullValues, sleep } from "./utils";

export const exportBans: ExporterFunc = async ctx => {
    ctx.setProgress("Exporting bans...");
    const url = `/guilds/${ctx.guildId}/bans`;
    ctx.logger.info(`Fetching bans from ${url}`);
    try {
        let allBans: any[] = [];
        let after: string | null = null;
        let hasMore = true;

        while (hasMore) {
            const query: any = { limit: 1000 };
            if (after) query.after = after;

            const resp = await (RestAPI as any).get({ url, query });
            if (resp.ok) {
                const bans = resp.body || [];
                allBans = [...allBans, ...bans];
                ctx.logger.info(`Fetched ${bans.length} bans (Total: ${allBans.length})`);

                if (bans.length < 1000) {
                    hasMore = false;
                } else {
                    after = bans[bans.length - 1].user.id;
                }
            } else {
                ctx.logger.error(`Failed to fetch bans: ${resp.status} - ${resp.body?.message || JSON.stringify(resp.body)}`);
                hasMore = false;
            }
            if (hasMore) await sleep(ctx.actionDelay || 500);
        }

        ctx.logger.info(`Successfully fetched ${allBans.length} bans`);
        await ctx.save("bans.json", JSON.stringify(removeNullValues(allBans), null, 2));
    } catch (e: any) {
        ctx.logger.error(`Failed to fetch guild bans: ${e?.message || e}`, e);
    }
    await sleep(ctx.actionDelay);
};
