/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs, EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";

const settings = definePluginSettings({
    keepOpen: {
        description: "Keeps the gif picker open after selecting a gif",
        type: OptionType.BOOLEAN,
        default: false
    }
});

export default definePlugin({
    name: "BetterGifPicker",
    description: "Makes the gif picker open the favourite category by default",
    authors: [Devs.Samwich, EquicordDevs.justjxke],
    settings,
    closeSuppressCount: 0,
    patches: [
        {
            find: '"state",{resultType:',
            replacement: [{
                match: /(?<="state",{resultType:)null/,
                replace: '"Favorites"'
            }]
        },
        {
            find: '"handleSelectGIF",',
            replacement: {
                match: /"handleSelectGIF",(\i)=>\{/,
                replace: "$&$self.onGifSelect();"
            }
        },
        {
            find: "expression-picker-last-active-view",
            replacement: {
                match: /(\i)\.setState\(\{activeView:null/,
                replace: "if($self.consumeCloseSuppress())return;$1.setState({activeView:null"
            }
        }
    ],

    onGifSelect() {
        if (!settings.store.keepOpen) return;

        this.closeSuppressCount = 2;
    },

    consumeCloseSuppress() {
        if (!settings.store.keepOpen) {
            this.closeSuppressCount = 0;
            return false;
        }

        if (this.closeSuppressCount <= 0) return false;
        this.closeSuppressCount--;
        return true;
    }
});
