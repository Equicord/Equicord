/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EmojiStore, GuildStore, IconUtils, RestAPI, SoundboardStore, StickersStore } from "@webpack/common";

import { ExporterFunc } from "./types";
import { downloadAsset, removeNullValues, sanitize, sleep } from "./utils";

export const exportEmojis: ExporterFunc = async ctx => {
    ctx.setProgress("Exporting emojis...");
    let emojis = EmojiStore.getGuildEmoji(ctx.guildId);

    if (!emojis || emojis.length === 0) {
        ctx.logger.info("Emojis not found in store, fetching from API...");
        try {
            const resp = await RestAPI.get({
                url: `/guilds/${ctx.guildId}/emojis`
            });
            if (resp.ok && Array.isArray(resp.body)) {
                emojis = resp.body;
            }
        } catch (e) {
            ctx.logger.error("Failed to fetch emojis from API", e);
        }
    }

    const emojiList = emojis || [];
    ctx.logger.info(`Found ${emojiList.length} emojis`);
    await ctx.save("emojis.json", JSON.stringify(removeNullValues(emojiList), null, 2));

    for (const emoji of emojiList) {
        const ext = emoji.animated ? ".gif" : ".png";
        const endpoint = window.GLOBAL_ENV.MEDIA_PROXY_ENDPOINT;
        const url = `https:${endpoint}/emojis/${emoji.id}${ext}?size=512&quality=lossless`;
        const name = ctx.filenameFormat === "Names" ? `${sanitize(emoji.name)}_${emoji.id}` : emoji.id;

        ctx.logger.info(`Downloading emoji: ${emoji.name} (${emoji.id})`);
        await downloadAsset(url, `emojis/${name}${ext}`, ctx);
        if (ctx.actionDelay > 0) await sleep(ctx.actionDelay);
    }
};

export const exportStickers: ExporterFunc = async ctx => {
    ctx.setProgress("Exporting stickers...");
    let stickers = StickersStore.getStickersByGuildId(ctx.guildId);

    if (!stickers || stickers.length === 0) {
        ctx.logger.info("Stickers not found in store, fetching from API...");
        try {
            const resp = await RestAPI.get({
                url: `/guilds/${ctx.guildId}/stickers`
            });
            if (resp.ok && Array.isArray(resp.body)) {
                stickers = resp.body;
            }
        } catch (e) {
            ctx.logger.error("Failed to fetch stickers from API", e);
        }
    }

    const stickerList = stickers || [];
    ctx.logger.info(`Found ${stickerList.length} stickers`);
    await ctx.save("stickers.json", JSON.stringify(removeNullValues(stickerList), null, 2));

    for (const sticker of stickerList) {
        // Handle both API (format_type) and Store (formatType) camelCase/snake_case
        const formatType = sticker.format_type ?? (sticker as any).formatType;
        const ext = formatType === 4 ? ".gif" : ".png";
        const url = `https://cdn.discordapp.com/stickers/${sticker.id}${ext}`;
        const name = ctx.filenameFormat === "Names" ? `${sanitize(sticker.name)}_${sticker.id}` : sticker.id;

        ctx.logger.info(`Downloading sticker: ${sticker.name} (${sticker.id})`);
        await downloadAsset(url, `stickers/${name}${ext}`, ctx);
        if (ctx.actionDelay > 0) await sleep(ctx.actionDelay);
    }
};

export const exportSounds: ExporterFunc = async ctx => {
    ctx.setProgress("Exporting soundboard sounds...");
    let sounds = SoundboardStore.getSoundsForGuild(ctx.guildId);

    if (!sounds || sounds.length === 0) {
        ctx.logger.info("Sounds not found in store, fetching from API...");
        try {
            const resp = await RestAPI.get({
                url: `/guilds/${ctx.guildId}/soundboard-sounds`
            });
            if (resp.ok && resp.body?.items) {
                sounds = resp.body.items;
            }
        } catch (e) {
            ctx.logger.error("Failed to fetch sounds from API", e);
        }
    }

    const soundList = (sounds || []) as any[];
    ctx.logger.info(`Found ${soundList.length} soundboard sounds`);

    const processedSounds = soundList.map(sound => {
        const { user, ...rest } = sound;
        return {
            ...rest,
            user_id: user?.id || rest.user_id || rest.userId
        };
    });

    await ctx.save("sounds.json", JSON.stringify(removeNullValues(processedSounds), null, 2));

    for (const sound of soundList) {
        const soundId = (sound as any).sound_id || (sound as any).soundId;
        const soundName = sound.name || "Unknown Sound";
        const url = `https://cdn.discordapp.com/soundboard-sounds/${soundId}`;
        const name = ctx.filenameFormat === "Names" ? `${sanitize(soundName)}_${soundId}` : soundId;

        ctx.logger.info(`Downloading sound: ${soundName} (${soundId})`);
        await downloadAsset(url, `sounds/${name}.mp3`, ctx);
        if (ctx.actionDelay > 0) await sleep(ctx.actionDelay);
    }
};

export const exportGuildAssets: ExporterFunc = async ctx => {
    ctx.setProgress("Exporting guild assets (Icon/Banner)...");
    const guild = GuildStore.getGuild(ctx.guildId);
    if (!guild) return;

    if (guild.icon) {
        const iconUrl = IconUtils.getGuildIconURL(guild);
        if (iconUrl) {
            const ext = iconUrl.includes(".gif") ? ".gif" : ".png";
            await downloadAsset(iconUrl, `icon${ext}`, ctx);
        }
    }

    if (guild.banner) {
        const bannerUrl = IconUtils.getGuildBannerURL(guild);
        if (bannerUrl) {
            const ext = bannerUrl.includes(".gif") ? ".gif" : ".png";
            await downloadAsset(bannerUrl, `banner${ext}`, ctx);
        }
    }
};
