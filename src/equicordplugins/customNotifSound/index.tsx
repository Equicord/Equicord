/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { makeRange, OptionType } from "@utils/types";
import { UserStore, WindowStore } from "@webpack/common";

const settings = definePluginSettings({
    "sound url": {
        type: OptionType.STRING,
        description: "for best results, use literally anything but a youtube link",
        default: "https://file.garden/agjfiCfMyBH0PBoA/yippee.wav"
    },
    "volume": {
        type: OptionType.SLIDER,
        description: "",
        default: 25,
        markers: makeRange(0, 99, 5)
    },
    "id whitelist": {
        type: OptionType.STRING,
        description: "your sound will play for messages from every (comma-space-separated) user, gc, server, etc. id you list here",
        restartNeeded: true
    },
    "sound timeout": {
        type: OptionType.NUMBER,
        description: "stay with me here, write your timeout length in centiseconds (151 = 1.51 seconds, 800 = 8 seconds, etc.)",
        default: 1500
    },
    "timer resets": {
        type: OptionType.BOOLEAN,
        description: "makes every subsequent message reset the sound timeout"
    },
    "check window focus": {
        type: OptionType.BOOLEAN,
        description: "makes your sound play only when discord isn't focused"
    },
    "self toggle": {
        type: OptionType.BOOLEAN,
        description: "plays your sound whenever you send a message"
    },
    "global toggle": {
        type: OptionType.BOOLEAN,
        description: "plays your sound for ***every*** message (use only if feeling extra silly :3)",
        default: false
    }
});

// this tracks cooldowns per user
const cooldowns = {} as Record<string, NodeJS.Timeout>;

export default definePlugin({
    name: "custom notification sound",
    description: "adds a custom notification sound to specified users, servers, etc",
    tags: ["Audio", "Customisation", "Media", "Notifications", "Sound"],
    authors: [{ name: "ellis (short for lsgrtha)", id: 617929613947043841n }],
    dependencies: ["AudioPlayerAPI"],
    searchTerms: ["Audio", "Sound"],
    settings,

    flux: {
        MESSAGE_CREATE({ message }: { message: any; }) {
            if (settings.store["id whitelist"]?.valueOf() !== undefined) {
                const watchedIDs = settings.store["id whitelist"].split(", ")
                    .map((id: string) => id.trim()).filter(Boolean);
                const yourID = UserStore.getCurrentUser().id;

                if (settings.store["self toggle"]) {
                    if (!watchedIDs.includes(yourID)) {
                        watchedIDs.push(yourID);
                    }

                    if(settings.store["check window focus"]){
                        settings.store["check window focus"] = false;
                    }
                }
                else {
                    if (watchedIDs.includes(yourID)) {
                        watchedIDs.splice(watchedIDs.indexOf(yourID), 1);
                    }
                }

                if (settings.store["check window focus"]) {
                    if (WindowStore.isAppFocused()) { return; }
                }

                if ((watchedIDs.includes(message.author.id) || settings.store["global toggle"])) {
                    const senderID = message.author.id as string;
                    let multipleMsgs = false;
                    if (cooldowns[senderID]) {
                        multipleMsgs = true;
                    }

                    if (multipleMsgs) {
                        if (settings.store["timer resets"]) {
                            clearTimeout(cooldowns[senderID]);
                        }
                        else {
                            return;
                        }
                    }
                    else {
                        const audio = new Audio(settings.store["sound url"].concat("?raw=true"));
                        audio.volume = settings.store.volume / 100;
                        audio.play().catch(() => { });
                    }

                    cooldowns[senderID] = setTimeout(() => {
                        delete cooldowns[senderID];
                    }, (settings.store["sound timeout"] * 10));
                }
            }
        }
    },

    stop() {
        // these remove all cooldowns when the plugin gets disabled
        Object.values(cooldowns).forEach(clearTimeout);
        Object.keys(cooldowns).forEach(key => delete cooldowns[key]);
    }
});
