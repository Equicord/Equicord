/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { isPluginEnabled } from "@api/PluginManager";
import favoriteGifSearch from "@plugins/favGifSearch";
import fixImagesQuality from "@plugins/fixImagesQuality";
import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";

type ImageProps = {
    src: string;
    width: number;
    height: number;
    contentType: string;
    mosaicStyleAlt?: boolean;
    trigger?: string;
};

type FavoriteGifSearchPlugin = {
    name: string;
    getFav?: (favorites: unknown[]) => unknown[];
    renderSearchBar?: (instance: { props?: { favCopy?: unknown[]; favorites?: unknown[]; }; }, SearchBarComponent: unknown) => unknown;
};

export default definePlugin({
    name: "DisableMediaTransforms",
    description: "Loads original Discord attachment URLs instead of transformed media proxy links.",
    authors: [EquicordDevs.keircn],
    patches: [
        {
            find: ".handleImageLoad)",
            replacement: {
                match: /getSrc\(\i\)\{/,
                replace: "$&var _vcSrc=$self.getOriginalAttachmentUrl(this.props?.src);if(_vcSrc)return _vcSrc;"
            }
        },
        {
            find: "renderHeaderContent()",
            replacement: {
                match: /(,suggestions:\i,favorites:)(\i),/,
                replace: "$1$self.normalizeGifItems($2),"
            }
        }
    ],

    start() {
        if (isPluginEnabled(fixImagesQuality.name) && typeof fixImagesQuality.getSrc === "function") {
            this.fixImagesQualityGetSrc = fixImagesQuality.getSrc.bind(fixImagesQuality);

            fixImagesQuality.getSrc = (props: ImageProps, freeze?: boolean) =>
                this.normalizeAttachmentUrl(this.fixImagesQualityGetSrc?.(props, freeze));
        }

        const favoriteGifSearchPlugin = favoriteGifSearch as unknown as FavoriteGifSearchPlugin;
        if (!isPluginEnabled(favoriteGifSearchPlugin.name)) return;

        if (typeof favoriteGifSearchPlugin.getFav === "function") {
            this.favoriteGifSearchGetFav = favoriteGifSearchPlugin.getFav.bind(favoriteGifSearchPlugin);
            favoriteGifSearchPlugin.getFav = favorites => this.normalizeGifItems(this.favoriteGifSearchGetFav?.(favorites) ?? favorites);
        }

        if (typeof favoriteGifSearchPlugin.renderSearchBar === "function") {
            this.favoriteGifSearchRenderSearchBar = favoriteGifSearchPlugin.renderSearchBar.bind(favoriteGifSearchPlugin);
            favoriteGifSearchPlugin.renderSearchBar = (instance, SearchBarComponent) => {
                const favCopy = instance.props?.favCopy;
                if (favCopy) instance.props!.favCopy = this.normalizeGifItems(favCopy);

                const favorites = instance.props?.favorites;
                if (favorites) instance.props!.favorites = this.normalizeGifItems(favorites);

                return this.favoriteGifSearchRenderSearchBar?.(instance, SearchBarComponent);
            };
        }
    },

    stop() {
        if (this.fixImagesQualityGetSrc) {
            fixImagesQuality.getSrc = this.fixImagesQualityGetSrc;
            this.fixImagesQualityGetSrc = undefined;
        }

        const favoriteGifSearchPlugin = favoriteGifSearch as unknown as FavoriteGifSearchPlugin;
        if (this.favoriteGifSearchGetFav) {
            favoriteGifSearchPlugin.getFav = this.favoriteGifSearchGetFav;
            this.favoriteGifSearchGetFav = undefined;
        }

        if (this.favoriteGifSearchRenderSearchBar) {
            favoriteGifSearchPlugin.renderSearchBar = this.favoriteGifSearchRenderSearchBar;
            this.favoriteGifSearchRenderSearchBar = undefined;
        }
    },

    fixImagesQualityGetSrc: undefined as ((props: ImageProps, freeze?: boolean) => string | undefined) | undefined,
    favoriteGifSearchGetFav: undefined as ((favorites: unknown[]) => unknown[]) | undefined,
    favoriteGifSearchRenderSearchBar: undefined as ((instance: { props?: { favCopy?: unknown[]; favorites?: unknown[]; }; }, SearchBarComponent: unknown) => unknown) | undefined,

    getOriginalAttachmentUrl(src?: string) {
        if (!src) return;

        return this.normalizeAttachmentUrl(src);
    },

    normalizeAttachmentUrl(src?: string) {
        if (!src) return;

        try {
            const url = new URL(src);
            const isMediaHost = url.hostname === "media.discordapp.net";
            const isCdnHost = url.hostname === "cdn.discordapp.com";
            if (!isMediaHost && !isCdnHost) return;

            if (isMediaHost && url.pathname.startsWith("/attachments/")) {
                url.hostname = "cdn.discordapp.com";
            }

            url.searchParams.delete("width");
            url.searchParams.delete("height");
            url.searchParams.delete("quality");
            url.searchParams.delete("format");
            url.searchParams.delete("animated");
            url.searchParams.delete("size");
            return url.toString();
        } catch {
            return;
        }
    },

    normalizeGifItems<T>(items: T[]) {
        if (!Array.isArray(items) || !items.length) return items;

        let changed = false;
        const normalized = items.map(item => {
            const normalizedItem = this.normalizeValue(item);
            if (normalizedItem === item) return item;

            changed = true;
            return normalizedItem;
        });

        return changed ? normalized : items;
    },

    normalizeValue<T>(value: T): T {
        if (typeof value === "string") {
            return (this.normalizeAttachmentUrl(value) ?? value) as T;
        }

        if (Array.isArray(value)) {
            let changed = false;
            const normalized = value.map(entry => {
                const normalizedEntry = this.normalizeValue(entry);
                if (normalizedEntry !== entry) changed = true;
                return normalizedEntry;
            });

            return (changed ? normalized : value) as T;
        }

        if (!value || typeof value !== "object") return value;

        let changed = false;
        const entries = Object.entries(value);
        const normalizedEntries = entries.map(([key, entry]) => {
            const normalizedEntry = this.normalizeValue(entry);
            if (normalizedEntry !== entry) changed = true;
            return [key, normalizedEntry] as const;
        });

        if (!changed) return value;
        return Object.fromEntries(normalizedEntries) as T;
    }
});
