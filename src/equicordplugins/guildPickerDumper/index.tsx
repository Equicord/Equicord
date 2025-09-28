/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { migratePluginSettings } from "@api/Settings";
import { Devs, EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import type { Guild } from "@vencord/discord-types";
import { EmojiStore, Menu, StickersStore } from "@webpack/common";
import { zipSync } from "fflate";

const StickerExt = [, "png", "apng", "json", "gif"] as const;

const Patch: NavContextMenuPatchCallback = (children, { guild }: { guild: Guild; }) => {
    // Assuming "privacy" is the correct ID for the group you want to modify.
    const group = findGroupChildrenByChildId("privacy", children);

    if (group) {
        group.push(
            <>
                <Menu.MenuItem id="emoji.download" label="Download Emojis" action={() => zipGuildAssets(guild, "emojis")}></Menu.MenuItem>
                <Menu.MenuItem id="sticker.download" label="Download Stickers" action={() => zipGuildAssets(guild, "stickers")}></Menu.MenuItem>
            </>
        );
    }
};

async function zipGuildAssets(guild: Guild, type: "emojis" | "stickers") {
    const isEmojis = type === "emojis";
    const items = isEmojis
        ? EmojiStore.getGuilds()[guild.id]?.emojis
        : StickersStore.getStickersByGuildId(guild.id);

    if (!items) {
        return console.log("Server not found!");
    }

    const fetchAsset = async (e: any) => {
        let ext: string;
        let url: string;

        if (isEmojis) {
            ext = e.animated ? ".gif" : ".png";
            const endpoint = window.GLOBAL_ENV.MEDIA_PROXY_ENDPOINT.startsWith("//")
                ? window.GLOBAL_ENV.MEDIA_PROXY_ENDPOINT.slice(2)
                : window.GLOBAL_ENV.MEDIA_PROXY_ENDPOINT;
            url = `https://${endpoint}/emojis/${e.id}${ext}?size=512&quality=lossless`;
        } else {
            ext = "." + StickerExt[e.format_type];
            const rawEndpoint = window.GLOBAL_ENV.MEDIA_PROXY_ENDPOINT;
            const endpoint = rawEndpoint.startsWith("//")
                ? rawEndpoint.slice(2)
                : rawEndpoint;
            const urlExt = e.format_type === 2 ? ".png" : ext;
            url = `https://${endpoint}/stickers/${e.id}${urlExt}?size=4096&lossless=true`;
        }

        const sanitizedName = e.name.replace(/[<>:"/\\|?*]/g, "_");
        let filename = `${sanitizedName}_${e.id}${ext}`;

        let response = await fetch(url);

        if (!isEmojis && e.format_type === 2 && (!response.ok || response.headers.get("content-type")?.includes("text"))) {
            const rawGifEndpoint = window.GLOBAL_ENV.MEDIA_PROXY_ENDPOINT;
            const gifEndpoint = rawGifEndpoint.startsWith("//")
                ? rawGifEndpoint.slice(2)
                : rawGifEndpoint;
            const gifUrl = `https://${gifEndpoint}/stickers/${e.id}.gif?size=4096&lossless=true`;
            const gifResponse = await fetch(gifUrl);

            if (gifResponse.ok && !gifResponse.headers.get("content-type")?.includes("text")) {
                response = gifResponse;
                ext = ".gif";
                filename = `${sanitizedName}_${e.id}${ext}`;
            }
        }

        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        return { file: new Uint8Array(arrayBuffer), filename };
    };

    const assetPromises = items.map(e => fetchAsset(e));

    Promise.all(assetPromises)
        .then(results => {
            const zipped = zipSync(Object.fromEntries(results.map(({ file, filename }) => [filename, file])));
            const blob = new Blob([zipped], { type: "application/zip" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `${guild.name}-${type}.zip`;
            link.click();
            link.remove();
        })
        .catch(console.error);
}

migratePluginSettings("GuildPickerDumper", "EmojiDumper");
export default definePlugin({
    name: "GuildPickerDumper",
    description: "Context menu to dump and download a server's emojis and stickers.",
    authors: [EquicordDevs.Cortex, Devs.Samwich, EquicordDevs.Synth, Devs.thororen],
    contextMenus: {
        "guild-context": Patch,
        "guild-header-popout": Patch
    }
});
