/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { React, UserStore } from "@webpack/common";

const fontOptions = [
    { label: "gg sans", value: "gg-sans", default: true },
    { label: "Tempo", value: "tempo" },
    { label: "Sakura", value: "sakura" },
    { label: "Jellybean", value: "jellybean" },
    { label: "Modern", value: "modern" },
    { label: "Medieval", value: "medieval" },
    { label: "8Bit", value: "8bit" },
    { label: "Vampyre", value: "vampyre" }
];

const fontMap: Record<string, string> = {
    "gg-sans": "'GG Sans', sans-serif",
    "tempo": "'Zilla Slab', serif",
    "sakura": "'Cherry Bomb One', cursive",
    "jellybean": "'Chicle', cursive",
    "modern": "'MuseoModerno', sans-serif",
    "medieval": "'Neo Castel', serif",
    "8bit": "'Pixelify Sans', monospace",
    "vampyre": "'Sinistre', cursive"
};

const settings = definePluginSettings({
    font: {
        type: OptionType.SELECT,
        description: "Font style for your name",
        options: fontOptions
    }
});

export default definePlugin({
    name: "NameStyleChanger",
    description: "Change the font style of your own username and display name. (basically Display Name Styles but free)",
    authors: [EquicordDevs.x2b],
    settings,

    patches: [
        {
            find: '="SYSTEM_TAG"',
            replacement: {
                match: /(onContextMenu:\i,children:)(.{0,250}?),"data-text":(\i\+\i)/,
                replace: "$1$self.applyNameStyle(arguments[0],$2),\"data-text\":$3"
            }
        }
    ],

    applyNameStyle(props: any, originalChildren: any) {
        const currentUser = UserStore.getCurrentUser();
        if (!currentUser) return originalChildren;

        const message = props?.message;
        const author = message?.author;
        if (!author || author.id !== currentUser.id) return originalChildren;

        const fontFamily = fontMap[settings.store.font] || fontMap["gg-sans"];

        return React.createElement("span", {
            style: { "font-family": fontFamily }
        }, originalChildren);
    }
});
