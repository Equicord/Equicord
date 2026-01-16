/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { findComponentByCodeLazy } from "@webpack";
import { ComponentDispatch, React } from "@webpack/common";

import { getTrendingGifs, GiphyGif, giphySettings, searchGifs } from "./utils/giphy";

export default definePlugin({
    name: "GiphyTab",
    description: "Adds a Giphy tab to the expression picker",
    authors: [EquicordDevs.secp192k1],
    settings: giphySettings,
    patches: [
        {
            find: "#{intl::EXPRESSION_PICKER_CATEGORIES_A11Y_LABEL}",
            replacement: [
                {
                    match: /(?<=(\i)\?(\(.{0,15}\))\((\i),\{.{0,150}(\i)===\i\.\i\.STICKER,.{0,150}children:(.{0,30}\.stickersNavItem,children:.{0,25})\}\)\}\):null)/,
                    replace: ',vcGiphyTab=$1?$2($3,{id:"vc-giphy-picker-tab","aria-controls":"vc-giphy-picker-tab-panel","aria-selected":$4==="vcGiphyTab",isActive:$4==="vcGiphyTab",autoFocus:false,viewType:"vcGiphyTab",children:"Giphy GIFs"}):null'
                },
                {
                    match: /children:\[(\i,\i(?:,\i)*)\](?=.{0,5}\}\))/g,
                    replace: "children:[$1,vcGiphyTab]"
                },
                {
                    match: /:null,(([^,]{1,200})===.{1,30}\.STICKER&&\w+\?(\([^()]{1,10}\)).{1,15}?(\{.*?,onSelectSticker:.*?\})\):null)/,
                    replace: ':null,$2==="vcGiphyTab"?$3($self.giphyComponent,$4):null,$1'
                }
            ]
        }
    ],

    giphyComponent(props: { closePopout?: () => void; }) {
        return <GiphyPickerContent closePopout={props.closePopout} />;
    }
});

const SearchBar = findComponentByCodeLazy("#{intl::SEARCH}", "clearable", "autoComplete");

function GiphyPickerContent({ closePopout }: { closePopout?: () => void; }) {
    const [query, setQuery] = React.useState("");
    const [gifs, setGifs] = React.useState<GiphyGif[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [offset, setOffset] = React.useState(0);
    const [hasMore, setHasMore] = React.useState(true);

    const loadGifs = async (searchQuery: string, currentOffset: number, append: boolean) => {
        if (loading && currentOffset !== 0) return;
        setLoading(true);
        try {
            const limit = 25;
            const results = searchQuery
                ? await searchGifs(searchQuery, limit, currentOffset)
                : await getTrendingGifs(limit, currentOffset);

            if (results.length < limit) setHasMore(false);
            else setHasMore(true);

            if (append) {
                setGifs(prev => [...prev, ...results]);
            } else {
                setGifs(results);
            }
        } finally {
            setLoading(false);
        }
    };

    React.useEffect(() => {
        const timer = setTimeout(() => {
            setOffset(0);
            loadGifs(query, 0, false);
        }, 500);
        return () => clearTimeout(timer);
    }, [query]);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollHeight - scrollTop <= clientHeight + 100 && !loading && hasMore) {
            const newOffset = offset + 25;
            setOffset(newOffset);
            loadGifs(query, newOffset, true);
        }
    };

    const handleSelect = (gif: GiphyGif) => {
        if (ComponentDispatch) {
            ComponentDispatch.dispatchToLastSubscribed("INSERT_TEXT", {
                rawText: gif.images.original.url,
                plainText: gif.images.original.url
            });
        }
        closePopout?.();
    };

    return (
        <div className="vc-giphy-picker-wrapper">
            <div className="vc-giphy-picker-header">
                <div className="vc-giphy-search-container">
                    <SearchBar
                        query={query}
                        onChange={setQuery}
                        onClear={() => setQuery("")}
                        placeholder="Search Giphy"
                        autoFocus
                    />
                </div>
            </div>
            <div className="vc-giphy-picker-list-wrapper">
                <div className="vc-giphy-picker-scroller" onScroll={handleScroll}>
                    <div className="vc-giphy-picker-grid">
                        {gifs.length === 0 && !loading ? (
                            <div className="vc-giphy-empty">No GIFs found</div>
                        ) : (
                            <>
                                {gifs.map(gif => (
                                    <div
                                        key={gif.id}
                                        className="vc-giphy-gif-item"
                                        onClick={() => handleSelect(gif)}
                                        role="button"
                                        tabIndex={0}
                                    >
                                        <div className="vc-giphy-category-fade" />
                                        <div className="vc-giphy-category-text">
                                            <span className="vc-giphy-category-name">{gif.title}</span>
                                        </div>
                                        <video
                                            className="vc-giphy-gif-video"
                                            src={gif.images.original.mp4 || gif.images.original.url}
                                            autoPlay
                                            loop
                                            muted
                                            playsInline
                                        />
                                    </div>
                                ))}
                                {loading && <div className="vc-giphy-loader" style={{ gridColumn: "1 / -1", padding: "20px" }}>Loading...</div>}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
