/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";

const settings = definePluginSettings({
    onlyFavorites: {
        type: OptionType.BOOLEAN,
        description: "Only keep the GIF picker open when selecting from Favorites",
        default: true
    }
});

export default definePlugin({
    name: "KeepGifPickerOpen",
    description: "Keeps the GIF picker open after sending a GIF",
    tags: ["Media", "Chat"],
    authors: [Devs.rico],
    settings,

    pendingSends: 0,
    resetTimeout: null as ReturnType<typeof setTimeout> | null,

    patches: [
        {
            find: "handleSelectGIF=",
            replacement: {
                match: /handleSelectGIF=(?:(?:\((\i,\i)\))|(\i))=>\{/,
                replace: "$&$self.trackSelection(this);"
            }
        },
        {
            find: 'source_object:"GIF Picker",gif_url:',
            replacement: [
                {
                    match: /\(0,(\i\.\i)\)\(\),(\i\.current\?\.focus\(\))/,
                    replace: "if(!$self.isSuppressingClose()){(0,$1)();$2;}"
                },
                {
                    match: /(\i)&&\((\i\(!1\)),\(0,(\i\.\i)\)\(\),(\i)&&(\i\.current\?\.focus\(\))\)/,
                    replace: "$1&&($2,(!$self.isSuppressingClose()?((0,$3)(),$4&&$5):$self.finishSendingGif()))"
                }
            ]
        },
        {
            find: "expression-picker-last-active-view",
            replacement: {
                match: /function (\i)\((\i),(\i)\)\{let (\i)=(\i)\.getState\(\);/,
                replace: "$&if($self.isSuppressingClose())return;"
            }
        }
    ],

    trackSelection(picker?: { state?: { resultType?: string | null; }; props?: { resultType?: string | null; }; }) {
        const type = String(picker?.state?.resultType || picker?.props?.resultType || "").toLowerCase();
        const isFavorites = type === "favorites";

        if (!settings.store.onlyFavorites || isFavorites) {
            this.pendingSends++;
            if (this.resetTimeout) clearTimeout(this.resetTimeout);
            this.resetTimeout = setTimeout(() => {
                this.pendingSends = 0;
            }, 5000);
        }
    },

    isSuppressingClose(): boolean {
        return this.pendingSends > 0;
    },

    finishSendingGif() {
        if (this.pendingSends > 0) {
            this.pendingSends--;
        }
        if (this.pendingSends === 0 && this.resetTimeout) {
            clearTimeout(this.resetTimeout);
            this.resetTimeout = null;
        }
    }
});
