/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { React, showToast, useMemo } from "@webpack/common";

import { addGif, FavouriteGif, getGifs, GifMap, loadGifs, removeGif, subscribe } from "./store";

const settings = definePluginSettings({
    showPopup: {
        type: OptionType.BOOLEAN,
        description: "Show a popup when a GIF is saved locally because Discord's limit was reached",
        default: true
    }
});

export default definePlugin({
    name: "MoreFavouriteGifs",
    description: "Favourite more GIFs than Discord allows by saving the extra ones on this device",
    tags: ["Media", "Utility"],
    authors: [{ name: "Stormanzanii", id: 0n }],
    searchTerms: ["favorite", "gif", "limit"],
    settings,

    patches: [
        {
            find: "#{intl::FAVORITE_GIFS_LIMIT_REACHED_BODY}",
            replacement: [
                {
                    // When adding a favourite goes over Discord's size limit, save the GIF locally instead of showing the error
                    match: /(?<=(\i)\.gifs\[(\i\(\i\.url\))\]=\{[^}]+\},\i\.\i\.toBinary\(\i\)\.length>\d+\))return \i\.\i\.show\(\{[^}]+\}\),!1/,
                    replace: "return $self.saveGif($2,$1.gifs[$2],$1.gifs),!1"
                },
                {
                    // When removing a favourite, also remove it from the local favourites
                    match: /(\i) in (\i)\.gifs\?delete \2\.gifs\[\1\]:delete \2\.gifs\[(\i)\(\1\)\]/,
                    replace: "$self.deleteGif($1,$3($1)),$&"
                }
            ]
        },
        {
            // Everything that reads favourites (the GIF picker, the favourite star) goes through here
            find: '.sortBy("order").reverse().value()',
            replacement: {
                match: /return (\i)\.favoriteGifs\?\.gifs\?\?(\i)\}/,
                replace: "return $self.useAllGifs($1.favoriteGifs?.gifs??$2)}"
            }
        }
    ],

    start: loadGifs,

    saveGif(url: string, gif: FavouriteGif, discordGifs: GifMap) {
        const total = addGif(url, gif, discordGifs);

        if (settings.store.showPopup) {
            showToast(`Limit reached, saved locally (${total})`, "message");
        }
    },

    deleteGif: removeGif,

    useAllGifs(discordGifs: GifMap) {
        const localGifs = React.useSyncExternalStore(subscribe, getGifs);

        return useMemo(
            () => Object.keys(localGifs).length ? { ...localGifs, ...discordGifs } : discordGifs,
            [localGifs, discordGifs]
        );
    }
});
