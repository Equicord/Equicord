/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { UserStore } from "@webpack/common";

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

    observer: null as MutationObserver | null,

    start() {
        this.currentFont = settings.store.font;
        this.applyFontToNames();
        this.setupObserver();
        this.timer = setInterval(() => {
            if (this.currentFont !== settings.store.font) {
                this.currentFont = settings.store.font;
                this.applyFontToNames();
            }
        }, 1000);
    },

    stop() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    },

    setupObserver() {
        this.observer = new MutationObserver(() => {
            this.applyFontToNames();
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    },

    applyFontToNames() {
        const currentUser = UserStore.getCurrentUser();
        if (!currentUser) return;

        const userNames = [currentUser.username];
        if (currentUser.globalName) userNames.push(currentUser.globalName);

        const fontFamily = fontMap[settings.store.font] || fontMap["gg-sans"];

        const selectors = [
            "[class*=\"username\"]",
            "[class*=\"clickable\"]",
            "[class*=\"title\"]"
        ];

        selectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach((el: Element) => {
                const text = el.textContent?.trim();
                if (text && userNames.some(name => text.includes(name))) {
                    (el as HTMLElement).style.setProperty("font-family", fontFamily, "important");
                }
            });
        });
    }
});
