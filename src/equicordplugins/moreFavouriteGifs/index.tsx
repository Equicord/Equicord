/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";
import { definePluginSettings } from "@api/Settings";
import { BaseText } from "@components/BaseText";
import definePlugin, { OptionType } from "@utils/types";
import { closeModal, Modal, openModal, React, useMemo } from "@webpack/common";

const settings = definePluginSettings({
    showPopup: {
        type: OptionType.BOOLEAN,
        description: "Show a popup when a favourite is saved locally because Discord's limit was reached",
        default: true
    }
});

const STORE_KEY = "MoreFavouriteGifs_gifs";

interface FavouriteGif {
    format: number;
    src: string;
    width: number;
    height: number;
    order: number;
}

type GifMap = Record<string, FavouriteGif>;

// Replaced (never mutated) on every change so it works as a useSyncExternalStore snapshot
let localGifs: GifMap = {};
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => void listeners.delete(listener);
}

const getSnapshot = () => localGifs;

function setLocalGifs(next: GifMap) {
    localGifs = next;
    listeners.forEach(l => l());
    DataStore.set(STORE_KEY, next).catch(e => console.error("[MoreFavouriteGifs] Failed to save", e));
}

let popupKey: string | undefined;

// Auto-closing modal without buttons, so repeated favourites don't need dismissing
function showSavedPopup(count: number) {
    if (popupKey) closeModal(popupKey);

    const key = popupKey = openModal(props => (
        <Modal {...props} size="sm" title="Favourite Limit Reached">
            <BaseText size="md" style={{ paddingBottom: 16 }}>
                {`Discord's favourite GIF limit was reached, so this GIF was saved locally (${count} local).`}
            </BaseText>
        </Modal>
    ));

    setTimeout(() => {
        closeModal(key);
        if (popupKey === key) popupKey = undefined;
    }, 3500);
}

function maxOrder(...maps: GifMap[]) {
    let max = 0;
    for (const map of maps)
        for (const gif of Object.values(map))
            if (gif.order > max) max = gif.order;
    return max;
}

export default definePlugin({
    name: "MoreFavouriteGifs",
    description: "Lets you favourite GIFs past Discord's limit by storing the extra ones locally",
    authors: [{ name: "Stormanzanii", id: 0n }],
    tags: ["Media", "Utility"],
    searchTerms: ["favorite", "gif", "limit"],

    settings,

    patches: [
        {
            // Adding a favourite: when the settings proto would exceed the size limit, save locally instead of showing the limit alert
            find: "#{intl::FAVORITE_GIFS_LIMIT_REACHED_BODY}",
            replacement: [
                {
                    match: /if\((\i)\.gifs\[(\i\(\i\.url\))\]=(\{[^}]+\}),(\i\.\i\.toBinary\(\1\)\.length>\d+)\)return/,
                    replace: "if($1.gifs[$2]=$3,$4)return $self.addLocal($2,$1.gifs[$2],$1.gifs),!1;if(0)return"
                },
                {
                    // Removing a favourite: also drop it from the local store
                    match: /(\i) in (\i)\.gifs\?delete \2\.gifs\[\1\]:delete \2\.gifs\[(\i)\(\1\)\]/,
                    replace: "$self.removeLocal($1,$3($1)),$&"
                }
            ]
        },
        {
            // Hook every favourites consumer (picker list, favourite star state) reads from; merge local GIFs in
            find: '.sortBy("order").reverse().value()',
            replacement: {
                match: /return (\i)\.favoriteGifs\?\.gifs\?\?(\i)\}/,
                replace: "return $self.useMergedGifs($1.favoriteGifs?.gifs??$2)}"
            }
        }
    ],

    async start() {
        const saved = await DataStore.get<GifMap>(STORE_KEY);
        if (saved) {
            localGifs = saved;
            listeners.forEach(l => l());
        }
    },

    addLocal(key: string, gif: FavouriteGif, protoGifs: GifMap) {
        const { format, src, width, height } = gif;
        const order = maxOrder(protoGifs, localGifs) + 1;

        setLocalGifs({ ...localGifs, [key]: { format, src, width, height, order } });

        if (settings.store.showPopup) showSavedPopup(Object.keys(localGifs).length);
    },

    removeLocal(url: string, normalisedUrl: string) {
        if (!(url in localGifs) && !(normalisedUrl in localGifs)) return;

        const next = { ...localGifs };
        delete next[url];
        delete next[normalisedUrl];
        setLocalGifs(next);
    },

    useMergedGifs(protoGifs: GifMap) {
        const local = React.useSyncExternalStore(subscribe, getSnapshot);
        return useMemo(
            () => Object.keys(local).length ? { ...local, ...protoGifs } : protoGifs,
            [protoGifs, local]
        );
    }
});
