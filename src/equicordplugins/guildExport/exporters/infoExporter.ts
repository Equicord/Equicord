/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { GuildMemberCountStore, GuildStore, UserGuildSettingsStore } from "@webpack/common";

import { ExporterFunc } from "./types";
import { removeNullValues, sleep } from "./utils";

export const exportInfo: ExporterFunc = async ctx => {
    ctx.setProgress("Exporting general information...");
    const guild = GuildStore.getGuild(ctx.guildId);
    if (!guild) return;

    const info = {
        id: guild.id,
        name: guild.name,
        icon: guild.icon,
        description: guild.description,
        ownerId: guild.ownerId,
        verificationLevel: guild.verificationLevel,
        rulesChannelId: guild.rulesChannelId,
        publicUpdatesChannelId: guild.publicUpdatesChannelId,
        preferredLocale: guild.preferredLocale,
        features: guild.features,
        vanityURLCode: guild.vanityURLCode,
        nsfwLevel: guild.nsfwLevel,
        premiumTier: guild.premiumTier,
        premiumSubscriberCount: (guild as any).premiumSubscriberCount,
        totalMembers: GuildMemberCountStore.getMemberCount(ctx.guildId),
        activeMembers: (GuildMemberCountStore as any).getOnlineCount?.(ctx.guildId) || (GuildMemberCountStore as any).getOnlineMemberCount?.(ctx.guildId),
    };
    await ctx.save("info.json", JSON.stringify(removeNullValues(info), null, 2));

    try {
        const guildSettings = (UserGuildSettingsStore as any).getAllSettings?.()?.[ctx.guildId];
        if (guildSettings) {
            await ctx.save("settings.json", JSON.stringify(removeNullValues(guildSettings), null, 2));
        }
    } catch (e) {
        ctx.logger.warn("Failed to fetch guild settings", e);
    }

    await sleep(ctx.actionDelay);
};
