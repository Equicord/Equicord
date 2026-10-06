/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";
import { definePluginSettings, Settings } from "@api/Settings";
import { markLocalSettingsDirty, putCloudSettings, shouldCloudSync } from "@api/SettingsSync/cloudSync";
import { Button } from "@components/Button";
import { Flex } from "@components/Flex";
import { debounce } from "@shared/debounce";
import { EquicordDevs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import { parseUrl } from "@utils/misc";
import definePlugin, { OptionType } from "@utils/types";
import { chooseFile, saveFile } from "@utils/web";
import { React, showToast, useMemo } from "@webpack/common";

interface FavouriteGif {
    format: number;
    src: string;
    width: number;
    height: number;
    order: number;
}

type GifMap = Record<string, FavouriteGif>;

const DATA_KEY = "MoreFavouriteGifs_gifs";
const BACKUP_FILE = "more-favourite-gifs.json";
const logger = new Logger("MoreFavouriteGifs");

let localGifs: GifMap = {};
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => void listeners.delete(listener);
}

const pushToCloud = debounce(() => {
    if (Settings.cloud.settingsSync && Settings.cloud.authenticated && shouldCloudSync("push")) {
        putCloudSettings();
    }
}, 60_000);

function setLocalGifs(gifs: GifMap) {
    localGifs = gifs;
    listeners.forEach(listener => listener());

    DataStore.set(DATA_KEY, gifs)
        .then(() => {
            if (!settings.store.cloudSync) return;
            markLocalSettingsDirty();
            pushToCloud();
        })
        .catch(e => logger.error("Failed to save favourites", e));
}

function isFavouriteGif(gif: unknown): gif is FavouriteGif {
    return typeof gif === "object" && gif !== null
        && "src" in gif && typeof gif.src === "string"
        && "format" in gif && Number.isFinite(gif.format)
        && "width" in gif && Number.isFinite(gif.width)
        && "height" in gif && Number.isFinite(gif.height)
        && "order" in gif && Number.isFinite(gif.order);
}

function parseBackup(text: string) {
    const data: unknown = JSON.parse(text);
    if (typeof data !== "object" || data === null || !("gifs" in data) || typeof data.gifs !== "object" || data.gifs === null) {
        throw new Error("This file isn't a favourite GIFs backup");
    }

    const gifs: GifMap = {};
    for (const [url, gif] of Object.entries(data.gifs)) {
        const protocol = parseUrl(url)?.protocol;
        if (!isFavouriteGif(gif) || (protocol !== "https:" && protocol !== "http:")) continue;

        const { format, src, width, height, order } = gif;
        gifs[url] = { format, src, width, height, order };
    }

    if (!Object.keys(gifs).length) throw new Error("No favourite GIFs found in this file");
    return gifs;
}

async function exportBackup() {
    const data = new TextEncoder().encode(JSON.stringify({ gifs: localGifs }, null, 4));

    if (IS_DISCORD_DESKTOP) {
        await DiscordNative.fileManager.saveWithDialog(data, BACKUP_FILE);
    } else {
        saveFile(new File([data], BACKUP_FILE, { type: "application/json" }));
    }
}

async function importBackup() {
    const file = await chooseFile("application/json");
    if (!file) return;

    try {
        const backup = parseBackup(await file.text());
        const added = Object.keys(backup).filter(url => !(url in localGifs)).length;

        if (added) setLocalGifs({ ...backup, ...localGifs });
        showToast(added ? `Restored ${added} GIFs` : "All of these GIFs are already saved", "success");
    } catch (e) {
        logger.error("Failed to import backup", e);
        showToast(`Failed to import backup: ${e instanceof Error ? e.message : String(e)}`, "failure");
    }
}

function BackupButtons() {
    return (
        <Flex gap="8px">
            <Button onClick={exportBackup}>Export Backup</Button>
            <Button variant="secondary" onClick={importBackup}>Import Backup</Button>
        </Flex>
    );
}

const settings = definePluginSettings({
    showPopup: {
        type: OptionType.BOOLEAN,
        description: "Show a popup when a GIF is saved locally because Discord's limit was reached.",
        default: true
    },
    cloudSync: {
        type: OptionType.BOOLEAN,
        description: "Include local favourites in Equicord Cloud settings sync.",
        default: true
    },
    backup: {
        type: OptionType.COMPONENT,
        description: "Save local favourites to a file, or restore them from one. Restoring keeps the GIFs you already have.",
        component: BackupButtons
    }
});

export default definePlugin({
    name: "MoreFavouriteGifs",
    description: "Lets you favourite more GIFs than Discord allows by saving the extra ones locally.",
    tags: ["Media", "Utility"],
    authors: [EquicordDevs.stormanzanii],
    searchTerms: ["favorite", "gif", "limit"],
    settings,

    patches: [
        {
            find: "#{intl::FAVORITE_GIFS_LIMIT_REACHED_BODY}",
            replacement: [
                {
                    match: /(?<=\.toBinary\((\i)\)\.length>\d+\)return )\i\.\i\.show\(\{.{0,100}?#{intl::FAVORITE_GIFS_LIMIT_REACHED_BODY}\)\}\)/,
                    replace: "$self.saveGif($1.gifs)"
                },
                {
                    match: /(?=(\i) in \i\.gifs\?delete \i\.gifs\[\i\]:delete \i\.gifs\[(\i)\(\i\)\])/,
                    replace: "$self.deleteGif($1,$2($1)),"
                }
            ]
        },
        {
            find: '.sortBy("order").reverse().value()',
            replacement: {
                match: /(?<=return )\i\.favoriteGifs\?\.gifs\?\?\i(?=\})/,
                replace: "$self.useAllGifs($&)"
            }
        }
    ],

    start() {
        DataStore.get<GifMap>(DATA_KEY)
            .then(saved => {
                localGifs = { ...saved, ...localGifs };
                listeners.forEach(listener => listener());
            })
            .catch(e => logger.error("Failed to load favourites", e));
    },

    saveGif(discordGifs: GifMap) {
        const [url, { format, src, width, height, order }] = Object.entries(discordGifs)
            .reduce((newest, entry) => entry[1].order > newest[1].order ? entry : newest);
        const localOrders = Object.values(localGifs).map(gif => gif.order + 1);

        setLocalGifs({ ...localGifs, [url]: { format, src, width, height, order: Math.max(order, ...localOrders) } });

        if (settings.store.showPopup) {
            showToast(`Limit reached, saved locally (${Object.keys(localGifs).length})`, "message");
        }
    },

    deleteGif(url: string, normalisedUrl: string) {
        if (!(url in localGifs) && !(normalisedUrl in localGifs)) return;

        const gifs = { ...localGifs };
        delete gifs[url];
        delete gifs[normalisedUrl];
        setLocalGifs(gifs);
    },

    useAllGifs(discordGifs: GifMap) {
        const gifs = React.useSyncExternalStore(subscribe, () => localGifs);
        return useMemo(() => ({ ...gifs, ...discordGifs }), [gifs, discordGifs]);
    }
});
