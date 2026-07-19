/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType } from "@api/Commands";
import { showNotification } from "@api/Notifications";
import { isPluginEnabled } from "@api/PluginManager";
import { definePluginSettings } from "@api/Settings";
import equicordToolbox from "@equicordplugins/equicordToolbox";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { saveFile } from "@utils/web";
import { Menu, UserSettingsActionCreators } from "@webpack/common";

interface FavoriteGif {
    src?: string;
    url?: string;
    width?: number;
    height?: number;
    order?: number;
    format?: number;
}

const enum LinkType {
    Source = "source",
    Key = "key",
}

const settings = definePluginSettings({
    linkType: {
        description: "Which URL to export for each favorite",
        type: OptionType.SELECT,
        options: [
            {
                label: "Direct media link (recommended) — the real .gif/.mp4 you can open or download",
                value: LinkType.Source,
                default: true
            },
            {
                label: "Saved key link — the raw URL Discord stored (may be a proxy)",
                value: LinkType.Key
            }
        ]
    },
    showToolboxButton: {
        description: "Show 'Save Favorite GIFs' button in Equicord Toolbox (Requires Reload)",
        type: OptionType.BOOLEAN,
        default: true,
        restartNeeded: true,
        get hidden() {
            return !isPluginEnabled(equicordToolbox.name);
        }
    }
});

/**
 * Discord proxies external media through images-ext-*.discordapp.net (and
 * sometimes media.discordapp.net) using an
 *   /external/<hash>/.../https/<host>/<path>
 * layout. The real, portable link is embedded after the http(s) segment, so we
 * rebuild it. Anything that isn't a Discord external proxy is returned as-is.
 */
function unwrapDiscordProxy(url: string): string {
    try {
        const u = new URL(url);
        if (!u.hostname.endsWith("discordapp.net")) return url;
        if (!u.pathname.startsWith("/external/")) return url;

        const parts = u.pathname.split("/").filter(Boolean);
        const protoIdx = parts.findIndex(p => p === "https" || p === "http");
        if (protoIdx === -1 || protoIdx >= parts.length - 1) return url;

        const proto = parts[protoIdx];
        const rest = decodeURIComponent(parts.slice(protoIdx + 1).join("/"));
        return `${proto}://${rest}`;
    } catch {
        return url;
    }
}

function getGifUrls(): string[] {
    const gifs: Record<string, FavoriteGif> =
        UserSettingsActionCreators.FrecencyUserSettingsActionCreators
            .getCurrentValue().favoriteGifs.gifs;

    const entries = Object.entries(gifs)
        .sort((a, b) => (a[1]?.order ?? 0) - (b[1]?.order ?? 0));

    const urls = entries.map(([key, value]) => {
        const raw = settings.store.linkType === LinkType.Source
            ? (value?.src ?? key)
            : key;
        return unwrapDiscordProxy(raw);
    });

    return [...new Set(urls)];
}

async function saveContentToFile(content: string, filename: string) {
    try {
        if (IS_DISCORD_DESKTOP) {
            const data = new TextEncoder().encode(content);
            await DiscordNative.fileManager.saveWithDialog(data, filename);
        } else {
            const file = new File([content], filename, { type: "text/plain" });
            saveFile(file);
        }

        showNotification({
            title: "Save Favorite GIFs",
            body: `Saved GIFs successfully as ${filename}`,
            color: "var(--text-positive)",
        });
    } catch (error) {
        console.error(error);
        showNotification({
            title: "Save Favorite GIFs",
            body: "Failed to save GIFs",
            color: "var(--text-danger)",
        });
    }
}

async function saveAllGifs() {
    const filename = `favorite-gifs-${new Date().toISOString().split("T")[0]}.txt`;
    const gifUrls = getGifUrls();

    if (gifUrls.length === 0) {
        showNotification({ title: "Save Favorite GIFs", body: "No favorite GIFs found..?" });
        return;
    }

    const content = gifUrls.join("\n");
    await saveContentToFile(content, filename);
}

async function saveWorkingGifs() {
    const gifUrls = getGifUrls();

    if (gifUrls.length === 0) {
        showNotification({ title: "Save Favorite GIFs", body: "No favorite GIFs found?" });
        return;
    }

    showNotification({
        title: "Save Favorite GIFs",
        body: `Testing ${gifUrls.length} GIFs.. This may take a moment...`,
    });

    const workingUrls: string[] = [];

    await Promise.all(gifUrls.map(async url => {
        try {
            const response = await fetch(url, { method: "HEAD" });
            if (response.ok) workingUrls.push(url);
        } catch (e) {
            try {
                const response = await fetch(url);
                if (response.ok) workingUrls.push(url);
            } catch (err) { }
        }
    }));

    if (workingUrls.length === 0) {
        showNotification({ title: "Save Favorite GIFs", body: "None of your saved GIFs appear to be working." });
        return;
    }

    const filename = `working-gifs-${new Date().toISOString().split("T")[0]}.txt`;
    const content = workingUrls.join("\n");

    await saveContentToFile(content, filename);

    showNotification({
        title: "Save Favorite GIFs",
        body: `Filtered ${gifUrls.length - workingUrls.length} possibly broken GIFs. Saved ${workingUrls.length} working GIFs.`,
        color: "var(--text-positive)",
    });
}

export default definePlugin({
    name: "ExportFavoriteGIFs",
    description: "Export favorited GIF urls",
    dependencies: ["CommandsAPI"],
    tags: ["Emotes", "Utility"],
    authors: [Devs.thororen],
    settings,
    commands: [
        {
            name: "savegifstest",
            description: "Save all favorite GIF urls to a text file",
            inputType: ApplicationCommandInputType.BUILT_IN,
            execute: saveAllGifs
        },
        {
            name: "saveworkinggifstest",
            description: "Test all favorite GIFs and only save the ones that are still working",
            inputType: ApplicationCommandInputType.BUILT_IN,
            execute: saveWorkingGifs
        }
    ],
    toolboxActions() {
        const { showToolboxButton } = settings.use(["showToolboxButton"]);
        if (!showToolboxButton) return null;

        return (
            <Menu.MenuItem
                id="save-favorite-gifs-toolbox-test"
                label="Save Favorite GIFs"
                action={saveAllGifs}
            />
        );
    }
});
