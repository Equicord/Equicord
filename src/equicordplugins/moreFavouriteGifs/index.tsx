/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";
import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { React, useMemo } from "@webpack/common";

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

let popupEl: HTMLElement | undefined;
let popupTimeout: ReturnType<typeof setTimeout> | undefined;

const CHECK_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M8 12.5l2.5 2.5L16 9.5" stroke="var(--background-base-lower, #111)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function removePopup() {
    clearTimeout(popupTimeout);
    popupEl?.remove();
    popupEl = undefined;
}

// Non-interactive popup at the top of the window: no backdrop, ignores clicks, closes itself
function showSavedPopup(count: number) {
    removePopup();

    const el = popupEl = document.createElement("div");
    el.setAttribute("role", "status");
    Object.assign(el.style, {
        position: "fixed",
        top: "44px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: "9999",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "12px 16px",
        maxWidth: "calc(100vw - 32px)",
        background: "var(--background-surface-high, var(--background-base-low))",
        border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))",
        borderRadius: "var(--radius-md, 8px)",
        boxShadow: "0 8px 16px rgba(0, 0, 0, 0.24)",
        color: "var(--text-default)",
        font: "500 14px/18px var(--font-primary, sans-serif)",
        whiteSpace: "nowrap",
        pointerEvents: "none",
        userSelect: "none"
    });

    const icon = document.createElement("span");
    icon.style.cssText = "display:flex;color:var(--status-positive,#23a55a)";
    icon.innerHTML = CHECK_ICON;

    const text = document.createElement("span");
    text.textContent = `Favourite limit reached, saved locally (${count} local)`;

    el.append(icon, text);
    document.body.append(el);

    el.animate(
        [{ opacity: 0, transform: "translate(-50%, -8px)" }, { opacity: 1, transform: "translate(-50%, 0)" }],
        { duration: 150, easing: "ease-out" }
    );

    popupTimeout = setTimeout(() => {
        const anim = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" });
        anim.onfinish = () => { if (popupEl === el) removePopup(); else el.remove(); };
    }, 3000);
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

    stop() {
        removePopup();
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
