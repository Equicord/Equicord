/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { definePluginSettings, migratePluginSettings } from "@api/Settings";
import { Badge } from "@components/Badge";
import ErrorBoundary from "@components/ErrorBoundary";
import { Devs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { identity, parseUrl } from "@utils/misc";
import definePlugin, { defineDefault, OptionType } from "@utils/types";
import { Constants, FluxDispatcher, GIFPickerViewStore, LocaleStore, RestAPI, Select, useEffect, useState } from "@webpack/common";

import * as GiphyProvider from "./giphy";
import * as TenorProvider from "./tenor";

let cachedCategories: TrendingCategoriesData | null = null;
const cl = classNameFactory("vc-gifProviderSwitcher-");

type Provider = "tenor" | "giphy" | "klipy";

const providerOptions: { label: string; value: Provider; }[] = [
    { label: "Tenor", value: "tenor" },
    { label: "Giphy", value: "giphy" },
    { label: "Klipy", value: "klipy" }
];

function ProviderSelect({ value, onChange }: { value: Provider | Provider[]; onChange(value: Provider[]): void; }) {
    const selected = Array.isArray(value) ? value : [value];
    return (
        <Select
            placeholder="Providers"
            options={providerOptions}
            closeOnSelect={false}
            isSelected={v => selected.includes(v)}
            select={(v: Provider) => {
                const next = selected.includes(v) ? selected.filter(p => p !== v) : [...selected, v];
                if (next.length) onChange(next);
            }}
            serialize={identity}
            renderOptionLabel={option => option.label}
            renderOptionValue={options => options.length === 1 ? options[0].label : `${options.length} providers`}
        />
    );
}

const settings = definePluginSettings({
    provider: {
        type: OptionType.COMPONENT,
        default: defineDefault<Provider | Provider[]>(["tenor"]),
        component: ({ setValue }) => {
            const [value, setSelected] = useState(settings.store.provider);
            return <ProviderSelect value={value} onChange={next => {
                setSelected(next);
                setValue(next);
            }} />;
        },
        onChange: () => {
            cachedCategories = null;
            fetchCategories();
        }
    }
});

const providers = {
    tenor: TenorProvider,
    giphy: GiphyProvider
};

function selectedProviders(): Provider[] {
    const { provider } = settings.store;
    return Array.isArray(provider) ? provider : [provider];
}

function primaryProvider() {
    return selectedProviders().find(p => p !== "klipy") ?? "klipy";
}

export interface DiscordGif {
    id: string;
    title: string;
    url: string;
    src: string;
    gif_src: string;
    width: number;
    height: number;
    preview: string;
}

export interface TrendingCategoriesData {
    trendingCategories: Record<"name" | "src", string>[];
    trendingGIFPreview: { src: string; };
}

async function fetchCategories() {
    if (!cachedCategories) {
        const provider = primaryProvider();
        if (provider === "klipy") {
            const res = await RestAPI.get({
                url: Constants.Endpoints.GIFS_TRENDING,
                query: {
                    locale: LocaleStore.locale,
                    media_format: GIFPickerViewStore.getSelectedFormat()
                },
            });
            cachedCategories = {
                trendingCategories: res.body.categories,
                trendingGIFPreview: res.body.gifs[0]
            };
        } else {
            cachedCategories = await providers[provider].getCategories();

            if (!cachedCategories) return;
        }
    }

    FluxDispatcher.dispatch({ type: "GIF_PICKER_TRENDING_FETCH_SUCCESS", ...cachedCategories });
}

migratePluginSettings("GifProviderSwitcher", "TenorGifSearch");
export default definePlugin({
    name: "GifProviderSwitcher",
    description: "Allows you to use Tenor or Giphy GIF search instead of Klipy",
    authors: [Devs.Lunascape, Devs.Ven],
    tags: ["Media", "Chat", "Emotes"],
    searchTerms: ["TenorGifSearch"],
    settings,

    patches: [
        {
            find: "renderGIF(){",
            replacement: {
                match: /this\.renderGIF\(\)/,
                replace: "$&,$self.renderProviderBadge(this.props.item)"
            }
        },
        {
            find: "renderHeaderContent()",
            replacement: [
                {
                    match: /(?<=return\(0,\i\.jsxs?\)\()(\i\.\i),{(?=query:\i.{0,100}?placeholder:)/,
                    replace: "$self.SearchWrapper,{Component:$1,"
                }
            ]
        },
        {
            find: '"GIF_PICKER_TRENDING_FETCH_SUCCESS",trendingCategories:',
            replacement: [
                {
                    match: /let \i=Date\.now\(\);\i\([^)]+\),\i\.\i\.get\(\{url:\i\.\i\.GIFS_SEARCH,query:\{q:(\i),/,
                    replace: "if($self.shouldReplace)return $self.handleSearchFetch($1);$&"
                },
                {
                    match: /""!==(\i)&&null!=\1&&\i\.\i\.get\(\{url:\i\.\i\.GIFS_SUGGEST,/,
                    replace: "if($self.shouldReplace)return $self.handleSuggestionsFetch($1);$&"
                },
                {
                    match: /\i\.\i\.get\(\{url:\i\.\i\.GIFS_TRENDING,/,
                    replace: "if($self.shouldReplace)return $self.handleTrendingFetch();$&"
                },
                {
                    match: /let \i=Date\.now\(\);\i\([^)]+\),\i\.\i\.get\(\{url:\i\.\i\.GIFS_TRENDING_GIFS,/,
                    replace: "if($self.shouldReplace)return $self.handleTrendingGifsFetch();$&"
                },
                {
                    match: /\i\.\i\.post\(\{url:\i\.\i\.GIFS_SELECT,body:\{id:(\i),q:(\i)\}/,
                    replace: "!$self.handleGifSelect($1,$2)&&$&"
                }
            ]
        },
        {
            find: '"IntegrationQueryStore"',
            replacement: {
                match: /(?<=search\((\i),(\i)\)\{)let \i=\i\.getResults\(\1,\2\)[,;]/,
                replace: "if($self.shouldReplace)return $self.tenorIntegrationSearch($1,$2);$&"
            }
        },
        // Add back tenor command
        {
            find: 'commandId:"-16"',
            replacement: {
                match: /commandId:"-16"}/,
                replace: '$&,TENOR:{type:"GIF",command:"tenor",title:"Tenor",commandId:"-9"}'
            }
        },
        {
            find: "#{intl::COMMAND_GIPHY_DESCRIPTION}",
            replacement: {
                match: /(\i)===\i\.\i\.GIF\.title/,
                replace: '$&||$1==="Tenor"'
            }
        }
    ],

    async start() {
        if (this.shouldReplace)
            cachedCategories = await this.provider.getCategories() ?? cachedCategories;
    },

    get shouldReplace() {
        return primaryProvider() !== "klipy";
    },

    get provider() {
        const provider = primaryProvider();
        if (provider === "klipy")
            throw new Error("Provider should never be klipy here");

        return providers[provider];
    },

    renderProviderBadge: ErrorBoundary.wrap(({ id, url }: { id?: string; url?: string; }) => {
        const name = id?.split(":")[0];
        const hostname = parseUrl(url ?? "")?.hostname;
        const provider = providerOptions.find(p => p.value === name)
            ?? providerOptions.find(p => hostname === `${p.value}.com` || hostname?.endsWith(`.${p.value}.com`));
        if (!provider) return null;

        return <Badge className={cl("badge")} text={provider.label} />;
    }, { noop: true }),

    SearchWrapper: ErrorBoundary.wrap(({ Component, placeholder, "aria-label": ariaLabel, ref, ...restProps }) => {
        const { provider } = settings.use(["provider"]);

        // restProps contains `autoFocus: true`, which should in theory focus the input automatically.
        // However, for whatever reason it focuses our Select instead, despite that not having autoFocus.
        // Discord is probably focusing it somewhere else for whatever reason, solved via this effect
        useEffect(() => ref?.current?.focus(), [ref]);

        const selected = Array.isArray(provider) ? provider : [provider];
        const names = providerOptions.filter(p => selected.includes(p.value)).map(p => p.label).join(", ");
        placeholder &&= placeholder.replace("Klipy", names);
        ariaLabel &&= ariaLabel.replace("Klipy", names);

        return (
            <div className="vc-tenorGifSearch-wrapper" onMouseDown={e => e.stopPropagation()}>
                <Component placeholder={placeholder} aria-label={ariaLabel} ref={ref} {...restProps} />
                <ProviderSelect value={provider} onChange={v => settings.store.provider = v} />
            </div>
        );
    }, { noop: true }),

    async LoadGifs(query: string | null, limit: number) {
        const results = await Promise.allSettled(selectedProviders().map(async provider => {
            let items: DiscordGif[];
            if (provider === "klipy") {
                const res = await RestAPI.get({
                    url: query === null ? Constants.Endpoints.GIFS_TRENDING_GIFS : Constants.Endpoints.GIFS_SEARCH,
                    query: { ...(query === null ? {} : { q: query }), limit, locale: LocaleStore.locale, media_format: GIFPickerViewStore.getSelectedFormat() }
                });
                items = res.body;
            } else {
                items = await (query === null ? providers[provider].getTrending(limit) : providers[provider].search(query, limit));
            }
            return items.map(item => ({ ...item, id: `${provider}:${item.id}` }));
        }));
        const pages = results.flatMap(result => result.status === "fulfilled" ? [result.value] : []);
        const items: DiscordGif[] = [];
        for (let i = 0; i < limit; i++) {
            for (const page of pages) {
                if (page[i]) items.push(page[i]);
            }
        }
        return items;
    },

    handleSearchFetch(query: string) {
        this.LoadGifs(query, 100)
            .then(items => {
                FluxDispatcher.dispatch(
                    items.length
                        ? { type: "GIF_PICKER_QUERY_SUCCESS", query, items }
                        : { type: "GIF_PICKER_QUERY_FAILURE", query }
                );
            })
            .catch(() => {
                FluxDispatcher.dispatch({ type: "GIF_PICKER_QUERY_FAILURE", query });
            });
    },

    async handleSuggestionsFetch(query: string) {
        if (!query) return;

        const items = await this.provider.searchSuggestions(query);

        FluxDispatcher.dispatch({ type: "GIF_PICKER_SUGGESTIONS_SUCCESS", query, items });
    },

    async handleTrendingFetch() {
        if (!cachedCategories) {
            cachedCategories = await this.provider.getCategories();

            if (!cachedCategories) return;
        }

        FluxDispatcher.dispatch({ type: "GIF_PICKER_TRENDING_FETCH_SUCCESS", ...cachedCategories });
    },

    handleGifSelect(id: string, query: string) {
        const separator = id.indexOf(":");
        const provider = id.slice(0, separator);
        const originalId = id.slice(separator + 1);
        let request: Promise<unknown>;
        if (provider === "klipy") {
            request = RestAPI.post({ url: Constants.Endpoints.GIFS_SELECT, body: { id: originalId, q: query } });
        } else if (provider === "tenor" || provider === "giphy") {
            request = providers[provider].registerShare(originalId, query);
        } else {
            if (!this.shouldReplace) return false;
            request = this.provider.registerShare(id, query);
        }
        request.catch(() => null);

        return true;
    },

    handleTrendingGifsFetch() {
        this.LoadGifs(null, 50)
            .then(items => {
                FluxDispatcher.dispatch(
                    items.length
                        ? { type: "GIF_PICKER_QUERY_SUCCESS", items }
                        : { type: "GIF_PICKER_QUERY_FAILURE" }
                );
            })
            .catch(() => {
                FluxDispatcher.dispatch({ type: "GIF_PICKER_QUERY_FAILURE" });
            });
    },

    tenorIntegrationSearch(integration: string, query: string) {
        FluxDispatcher.dispatch({ type: "INTEGRATION_QUERY", integration, query });

        this.LoadGifs(query, 20)
            .then(results => {
                FluxDispatcher.dispatch(
                    results.length
                        ? { type: "INTEGRATION_QUERY_SUCCESS", integration, query, results }
                        : { type: "INTEGRATION_QUERY_FAILURE", integration, query }
                );
            })
            .catch(() => {
                FluxDispatcher.dispatch({ type: "INTEGRATION_QUERY_FAILURE", integration, query, results: [] });
            });
    }
});
