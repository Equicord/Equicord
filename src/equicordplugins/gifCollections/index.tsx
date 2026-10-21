/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { ContextMenuApi, FluxDispatcher, Menu } from "@webpack/common";
import type { MouseEvent } from "react";

import { addCollectionContextMenuPatch, getGifPickerContextMenuItems, RemoveItemContextMenuItems } from "./components/contextMenus";
import { settings, SortingOptions } from "./settings";
import { Category, Collection, Gif, GifPickerInstance } from "./types";
import { cache_collections, refreshCacheCollection, updateGif } from "./utils/collectionManager";
import { getFormat } from "./utils/getFormat";
import { logger, stripPrefix } from "./utils/misc";
import { batchRefreshAttachmentUrls, isCdnUrlExpired } from "./utils/refreshUrl";

let GIF_COLLECTION_PREFIX: string;
let GIF_ITEM_PREFIX: string;
let refreshingUrls = false;
let oldTrendingCat: Category[] | null = null;

const gifPickerContextMenuPatch: NavContextMenuPatchCallback = (children, props) => {
    if (!props) return;
    const { name, id } = props;

    if (name?.startsWith(GIF_COLLECTION_PREFIX)) {
        children.push(RemoveItemContextMenuItems({ type: "collection", nameOrId: name }));
        return;
    }

    if (id?.startsWith(GIF_ITEM_PREFIX)) {
        children.push(RemoveItemContextMenuItems({ type: "gif", nameOrId: id }));
        return;
    }

    const { src, url, height, width } = props;
    if (!src || !url || !height || !width) return;

    children.push(getGifPickerContextMenuItems(src, url, height, width));
};

export default definePlugin({
    name: "GifCollections",
    description: "Allows you to create collections of gifs.",
    tags: ["Chat", "Emotes"],
    authors: [EquicordDevs.creations],
    settings,
    contextMenus: {
        "message": addCollectionContextMenuPatch,
        "gif-picker": gifPickerContextMenuPatch,
    },

    patches: [
        {
            find: "renderCategoryExtras",
            replacement: [
                {
                    match: /(render\(\){)(.{1,50}getItemGrid)/,
                    replace: "$1;$self.insertCollections(this);$2",
                },
                {
                    match: /("span",\{className:\i\.\i,children:)(\i)/,
                    replace: "$1$self.hidePrefix($2),",
                },
            ],
        },
        {
            find: "renderHeaderContent()",
            replacement: {
                match: /(renderContent\(\){)(.{1,50}resultItems)/,
                replace: "$1$self.renderContent(this);$2",
            },
        },
        {
            find: "type:\"GIF_PICKER_QUERY\"",
            replacement: {
                match: /(function \i\(.{1,10}\){)(.{1,200}.GIFS_SEARCH,query:)/,
                replace: "$1if($self.shouldStopFetch(arguments[0])) return;$2",
            },
        },
        {
            find: "#{intl::CATEGORY_FAVORITE}),icon:",
            replacement: {
                match: /(\i)\.name\),renderExtras:this\.renderCategoryExtras,/,
                replace: "$&onContextMenu:(e)=>$self.openCategoryContextMenu(e,$1),"
            }
        }
    ],

    start() {
        refreshCacheCollection();
        GIF_COLLECTION_PREFIX = settings.store.collectionPrefix;
        GIF_ITEM_PREFIX = settings.store.itemPrefix;
    },

    sortedCollections(): Collection[] {
        const sorted = [...cache_collections];
        const sortType = settings.store.collectionsSortType;
        const sortOrder = settings.store.collectionsSortOrder === "asc" ? 1 : -1;

        return sorted.sort((a, b) => {
            switch (sortType) {
                case SortingOptions.NAME:
                    return a.name.localeCompare(b.name) * sortOrder;
                case SortingOptions.CREATION_DATE:
                    return ((a.createdAt ?? 0) - (b.createdAt ?? 0)) * sortOrder;
                case SortingOptions.MODIFIED_DATE:
                    return ((a.lastUpdated ?? 0) - (b.lastUpdated ?? 0)) * sortOrder;
                default:
                    return 0;
            }
        });
    },

    renderContent(instance: GifPickerInstance) {
        if (!instance.props.query.startsWith(GIF_COLLECTION_PREFIX)) return;

        const collection = cache_collections.find(c => c.name === instance.props.query);
        if (!collection) return;

        instance.props.resultItems = collection.gifs.map(g => ({
            id: g.id,
            format: getFormat(g.src),
            src: g.src,
            url: g.url,
            width: g.width,
            height: g.height,
        })).reverse();

        const expiredGifs = collection.gifs.filter(g => g.src && g.url && (isCdnUrlExpired(g.src) || isCdnUrlExpired(g.url)));
        if (expiredGifs.length === 0) return;

        const allUrls = [...new Set<string>(
            expiredGifs.flatMap(g => [g.src, g.url].filter((u): u is string => !!u && isCdnUrlExpired(u)))
        )];

        if (!refreshingUrls) this.refreshExpiredUrls(allUrls, expiredGifs, instance.props.query);
    },

    async refreshExpiredUrls(urls: string[], expiredGifs: Gif[], query: string) {
        refreshingUrls = true;
        try {
            const fullMap: Record<string, string> = {};
            for (let i = 0; i < urls.length; i += 50) {
                const result = await batchRefreshAttachmentUrls(urls.slice(i, i + 50));
                Object.assign(fullMap, result);
            }

            if (!Object.keys(fullMap).length) return;

            let anyUpdated = false;
            for (const gif of expiredGifs) {
                const newSrc = fullMap[gif.src] ?? gif.src;
                const newUrl = fullMap[gif.url] ?? gif.url;
                if (newSrc !== gif.src || newUrl !== gif.url) {
                    await updateGif(gif.id, { ...gif, src: newSrc, url: newUrl });
                    anyUpdated = true;
                }
            }

            if (!anyUpdated) return;

            FluxDispatcher.dispatch({ type: "GIF_PICKER_QUERY", query: "" });
            FluxDispatcher.dispatch({ type: "GIF_PICKER_QUERY", query });
        } finally {
            refreshingUrls = false;
        }
    },

    hidePrefix: stripPrefix,

    insertCollections(instance: GifPickerInstance) {
        try {
            if (instance.props.trendingCategories.length && instance.props.trendingCategories[0].type === "Trending") {
                oldTrendingCat = instance.props.trendingCategories;
            }
            if (settings.store.onlyShowCollections) {
                instance.props.trendingCategories = this.sortedCollections();
            } else if (oldTrendingCat != null) {
                instance.props.trendingCategories = [...this.sortedCollections(), ...oldTrendingCat];
            }
        } catch (err) {
            logger.error("Failed to insert collections", err);
        }
    },

    shouldStopFetch(query: string) {
        return query.startsWith(GIF_COLLECTION_PREFIX) && cache_collections.some(c => c.name === query);
    },

    openCategoryContextMenu(e: MouseEvent, item: any) {
        if (!item?.name?.startsWith(GIF_COLLECTION_PREFIX)) return;

        const children = [RemoveItemContextMenuItems({ type: "collection", nameOrId: item.name })];

        ContextMenuApi.openContextMenu(e, () =>
            <Menu.Menu
                navId="gif-picker-category"
                onClose={() => FluxDispatcher.dispatch({ type: "CONTEXT_MENU_CLOSE" })}
                aria-label="GIF Picker Category Options"
            >
                {children}
            </Menu.Menu>
        );
    },
});
