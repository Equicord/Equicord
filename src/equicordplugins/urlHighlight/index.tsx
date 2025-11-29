/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings, SettingsStore } from "@api/Settings";
import { classNameFactory } from "@api/Styles";
import definePlugin, { OptionType } from "@utils/types";
import { EquicordDevs } from "@utils/constants";
import { Button } from "@components/Button";
import { ColorPicker, TextInput, useState } from "@webpack/common";
import { Flex } from "@components/Flex";
import { DeleteIcon } from "@components/Icons";
import ErrorBoundary from "@components/ErrorBoundary";
import { useForceUpdater } from "@utils/react";


const cl = classNameFactory("urlhighlight-");

interface URLEntry {
    domain: string;
    color: string; // #hex
}

let styleElement: HTMLStyleElement | null = null;

const handleSettingsChange = () => updateCSS();

function updateCSS() {
    if (styleElement) {
        document.head.removeChild(styleElement);
        styleElement = null;
    }

    const urlsString = settings.store.urls;
    if (!urlsString) return;

    let entries: URLEntry[];
    try {
        entries = JSON.parse(urlsString);
    } catch {
        return;
    }

    const colorEmbeds = settings.store.colorEmbeds;
    const boldUrls = settings.store.boldUrls;
    const rules: string[] = [];
    for (const entry of entries) {
        if (entry.domain) {
            const escaped = CSS.escape(entry.domain);
            const baseSelector = colorEmbeds ? `a[href*="${escaped}"]` : `div[class*="messageContent"] a[href*="${escaped}"]`;
            let rule = `${baseSelector} { color: ${entry.color} !important;${boldUrls ? ` font-weight: bold !important;` : ''} }`;
            rules.push(rule);
        }
    }

    if (rules.length === 0) return;

    styleElement = document.createElement("style");
    styleElement.textContent = rules.join("\n");
    document.head.appendChild(styleElement);
}

const settings = definePluginSettings({
    urls: {
        type: OptionType.COMPONENT,
        description: "URL patterns and colors. Enter domain (e.g. example.com matches subdomains).",
        component: URLListEditor
    },
    colorEmbeds: {
        type: OptionType.BOOLEAN,
        description: "Show the color on embed links if the embed has a link leading to the site.",
        default: false
    },
    boldUrls: {
        type: OptionType.BOOLEAN,
        description: "Make highlighted URLs bold.",
        default: false
    }
});

function URLListEditor() {
    const forceUpdate = useForceUpdater();
    const [entries, setEntries] = useState<URLEntry[]>(() => {
        const urlsString = settings.store.urls;
        if (!urlsString) return [];
        try {
            return JSON.parse(urlsString);
        } catch {
            return [];
        }
    });

    const save = (newEntries: URLEntry[]) => {
        settings.store.urls = JSON.stringify(newEntries);
        setEntries(newEntries);
        forceUpdate();
        updateCSS();
    };

    const addEntry = () => {
        const newEntries = [...entries, { domain: "", color: "#ff0000" }];
        save(newEntries);
    };

    const removeEntry = (index: number) => {
        const newEntries = entries.filter((_, i) => i !== index);
        save(newEntries);
    };

    const updateEntry = (index: number, field: keyof URLEntry, value: string) => {
        const newEntries = [...entries];
        newEntries[index] = { ...newEntries[index], [field]: value };
        save(newEntries);
    };

    return (
        <Flex flexDirection="column" className={cl("container")}>
            <ErrorBoundary>
                {entries.map((entry, index) => (
                    <Flex key={index} flexDirection="row" className={cl("entry-row")} alignItems="center" gap={8}>
                        <div style={{ flex: 1 }}>
                            <TextInput
                                value={entry.domain}
                                onChange={(v) => updateEntry(index, "domain", v)}
                                placeholder="example.com"
                            />
                        </div>
                        <div className={cl("color-wrapper")}>
                            <ColorPicker color={parseInt(entry.color.slice(1), 16)}
                                onChange={(color: number) => {
                                    const hex = "#" + color.toString(16).padStart(6, "0");
                                    updateEntry(index, "color", hex);
                                }}
                                showEyeDropper={false}
                            />
                        </div>
                        <Button
                            variant="secondary"
                            size="small"
                            className={cl("delete")}
                            onClick={() => removeEntry(index)}
                        >
                            <DeleteIcon />
                        </Button>
                    </Flex>
                ))}
                <Flex justifyContent="flex-start">
                    <Button
                        onClick={addEntry}
                        variant="secondary"
                        size="small"
                        className={cl("add-button")}
                    >
                        Add Entry
                    </Button>
                </Flex>
                {entries.length === 0 && (
                    <Flex justifyContent="center" style={{ padding: 20, opacity: 0.5 }}>
                        <div style={{ opacity: 0.5 }}>No entries. Click "Add Entry" to start.</div>
                    </Flex>
                )}
            </ErrorBoundary>
        </Flex>
    );
}

export default definePlugin({
    name: "URLHighlight",
    description: "Highlights specific URLs in messages with custom colors.",
    authors: [EquicordDevs.justjxke],

    settings,

    start() {
        updateCSS();
        SettingsStore.addChangeListener("plugins.URLHighlight.colorEmbeds", handleSettingsChange);
        SettingsStore.addChangeListener("plugins.URLHighlight.boldUrls", handleSettingsChange);
        SettingsStore.addChangeListener("plugins.URLHighlight.urls", handleSettingsChange);
    },

    stop() {
        if (styleElement) {
            document.head.removeChild(styleElement);
            styleElement = null;
        }
        SettingsStore.removeChangeListener("plugins.URLHighlight.colorEmbeds", handleSettingsChange);
        SettingsStore.removeChangeListener("plugins.URLHighlight.boldUrls", handleSettingsChange);
        SettingsStore.removeChangeListener("plugins.URLHighlight.urls", handleSettingsChange);
    },

});
