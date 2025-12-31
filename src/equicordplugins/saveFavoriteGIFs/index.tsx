/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandType } from "@api/Commands";
import { showNotification } from "@api/Notifications";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { saveFile } from "@utils/web";
import { UserSettingsActionCreators } from "@webpack/common";

// handle the file downloading
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

// get current gif list
function getGifUrls(): string[] {
    return Object.keys(UserSettingsActionCreators.FrecencyUserSettingsActionCreators.getCurrentValue().favoriteGifs.gifs);
}

// saving all gifs blindly
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

// checking and saving only working gifs
async function saveWorkingGifs() {
    const gifUrls = getGifUrls();
    
    if (gifUrls.length === 0) {
        showNotification({ title: "Save Favorite GIFs", body: "No favorite GIFs found..?" });
        return;
    }

    showNotification({
        title: "Save Favorite GIFs",
        body: `Testing ${gifUrls.length} GIFs.. This may take a moment......`,
        loading: true
    });

    const workingUrls: string[] = [];

    // using promise dot all to check them concurrently for speed
    await Promise.all(gifUrls.map(async (url) => {
        try {
            // using head to check existence without downloading the whole image
            const response = await fetch(url, { method: "HEAD" });
            if (response.ok) {
                workingUrls.push(url);
            }
        } catch (e) {
            // if head fails (some file hosts block it) try a standard get request
            try {
                const response = await fetch(url);
                if (response.ok) workingUrls.push(url);
            } catch (err) {
                // url is dead </3
            }
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
    name: "SaveFavoriteGIFs",
    description: "Export favorited GIF urls",
    authors: [Devs.thororen],
    dependencies: ["EquicordToolbox"],
    
    options: {
        showToolboxButton: {
            description: "Show 'Save Favorite GIFs' button in Equicord Toolbox (Requires Reload)",
            type: OptionType.BOOLEAN,
            default: true,
            restartNeeded: true 
        }
    },

    commands: [
        {
            name: "savegifs",
            description: "Save all favorite GIF urls to a text file",
            type: ApplicationCommandType.Chat,
            action: saveAllGifs
        },
        {
            name: "saveworkinggifs",
            description: "Test all favorite GIFs and only save the ones that are still working",
            type: ApplicationCommandType.Chat,
            action: saveWorkingGifs
        }
    ],

    // using a get here so we can check the settings (even though equicord toolbox usually reads this on load i think)
    get toolboxActions() {
        if (this.settings.showToolboxButton === false) {
            return {};
        }

        return {
            "Save Favorite GIFs": () => {
                saveAllGifs();
            }
        };
    }
});
