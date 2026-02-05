/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { GuildChannelStore } from "@webpack/common";

import { ExporterFunc } from "./types";
import { removeNullValues, sleep } from "./utils";

export const exportChannels: ExporterFunc = async ctx => {
    ctx.setProgress("Exporting channels...");
    const channels = GuildChannelStore.getChannels(ctx.guildId) || [];
    await ctx.save("channels.json", JSON.stringify(removeNullValues(channels), null, 2));
    await sleep(ctx.actionDelay);
};
