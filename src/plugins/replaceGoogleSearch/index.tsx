/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings, migratePluginSettings } from "@api/Settings";
import { Flex } from "@components/Flex";
import { Devs } from "@utils/constants";
import { t } from "@utils/translation";
import definePlugin, { OptionType } from "@utils/types";
import { Menu } from "@webpack/common";

const DefaultEngines = {
    Google: "https://www.google.com/search?q=",
    DuckDuckGo: "https://duckduckgo.com/?q=",
    Brave: "https://search.brave.com/search?q=",
    Bing: "https://www.bing.com/search?q=",
    Yahoo: "https://search.yahoo.com/search?p=",
    Yandex: "https://yandex.com/search/?text=",
    GitHub: "https://github.com/search?q=",
    Reddit: "https://www.reddit.com/search?q=",
    Wikipedia: "https://wikipedia.org/w/index.php?search=",
    Startpage: "https://www.startpage.com/sp/search?query="
} as const;

const enum ReplacementEngineValue {
    OFF = "off",
    CUSTOM = "custom",
}

const settings = definePluginSettings({
    customEngineName: {
        description: t("replaceGoogleSearch.settings.customEngineName"),
        type: OptionType.STRING,
        placeholder: "Google"
    },
    customEngineURL: {
        description: t("replaceGoogleSearch.settings.customEngineURL"),
        type: OptionType.STRING,
        placeholder: "https://google.com/search?q="
    },
    replacementEngine: {
        description: t("replaceGoogleSearch.settings.replacementEngine"),
        type: OptionType.SELECT,
        options: [
            { label: t("replaceGoogleSearch.settings.off"), value: ReplacementEngineValue.OFF, default: true },
            { label: t("replaceGoogleSearch.settings.customEngine"), value: ReplacementEngineValue.CUSTOM },
            ...Object.keys(DefaultEngines).map(engine => ({ label: engine, value: engine }))
        ]
    }
});

function search(src: string, engine: string) {
    open(engine + encodeURIComponent(src.trim()), "_blank");
}

function makeSearchItem(src: string) {
    const { customEngineName, customEngineURL, replacementEngine } = settings.store;

    const hasCustomEngine = Boolean(customEngineName && customEngineURL);
    const hasValidReplacementEngine = replacementEngine !== ReplacementEngineValue.OFF && !(replacementEngine === ReplacementEngineValue.CUSTOM && !hasCustomEngine);

    const Engines = { ...DefaultEngines };

    if (hasCustomEngine) {
        Engines[customEngineName!] = customEngineURL;
    }

    if (hasValidReplacementEngine) {
        const name = replacementEngine === ReplacementEngineValue.CUSTOM && hasCustomEngine
            ? customEngineName
            : replacementEngine;

        return (
            <Menu.MenuItem
                label={t("replaceGoogleSearch.searchWith", { engine: name })}
                key="search-custom-engine"
                id="vc-search-custom-engine"
                action={() => search(src, Engines[name!])}
            />
        );
    }

    return (
        <Menu.MenuItem
            label={t("replaceGoogleSearch.searchText")}
            key="search-text"
            id="vc-search-text"
        >
            {Object.keys(Engines).map(engine => {
                const key = "vc-search-content-" + engine;
                return (
                    <Menu.MenuItem
                        key={key}
                        id={key}
                        label={
                            <Flex gap="0.5em" alignItems="center">
                                <img
                                    style={{
                                        borderRadius: "50%"
                                    }}
                                    aria-hidden="true"
                                    height={16}
                                    width={16}
                                    src={`https://icons.duckduckgo.com/ip3/${new URL(Engines[engine]).hostname}.ico`}
                                />
                                {engine}
                            </Flex>
                        }
                        action={() => search(src, Engines[engine])}
                    />
                );
            })}
        </Menu.MenuItem>
    );
}

const messageContextMenuPatch: NavContextMenuPatchCallback = (children, _props) => {
    const selection = document.getSelection()?.toString();
    if (!selection) return;

    const group = findGroupChildrenByChildId("search-google", children);
    if (group) {
        const idx = group.findIndex(c => c?.props?.id === "search-google");
        if (idx !== -1) group[idx] = makeSearchItem(selection);
    }
};

migratePluginSettings("ReplaceGoogleSearch", "Search");
export default definePlugin({
    name: "ReplaceGoogleSearch",
    description: t("replaceGoogleSearch.description"),
    authors: [Devs.Moxxie, Devs.Ethan],

    settings,

    contextMenus: {
        "message": messageContextMenuPatch
    }
});
