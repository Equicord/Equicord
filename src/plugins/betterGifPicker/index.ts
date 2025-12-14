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
            find: "gifId:e.id",
            replacement: {
                match: /null!=\i&&\i\(\i\),/,
                replace: "$self.onGifSelect(),$&"
            }
        },
        {
            find: "expression-picker-last-active-view",
            replacement: {
                match: /(\i)\.setState\(\{activeView:null/,
                replace: "$self.consumeCloseSuppress()||$1.setState({activeView:null"
            }
        },
        {
            find: "desiredItemWidth:200,maxColumns:8",
            replacement: {
                match: /((?:[A-Za-z_$][\w$]*))\.scrollIntoViewRect\(\{start:((?:[A-Za-z_$][\w$]*))\.top-10,end:\2\.top\+\2\.height\+10\}\)/,
                replace: "$self.shouldSuppressGifFocusScroll()||$&"
            }
        },
        {
            find: "tabIndex:-1,innerRef:",
            replacement: {
                match: /tabIndex:-1,/,
                replace: "tabIndex:-1,onMouseDown:e=>{$self.shouldSuppressGifFocusScroll()&&e.preventDefault()},"
            },
            predicate: () => settings.store.keepOpen
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
    },

    shouldSuppressGifFocusScroll() {
        return settings.store.keepOpen;
    }
});
