/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";
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

const TitleClasses = findByPropsLazy("title", "container");
const UserClasses = findByPropsLazy("username", "discriminator");

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

    start() {
        this.currentFont = settings.store.font;
        this.applyFontToNames();
        this.timer = setInterval(() => {
            this.applyFontToNames();
            if (this.currentFont !== settings.store.font) {
                this.currentFont = settings.store.font;
            }
        }, 1000);
    },

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    },

    applyFontToNames() {
        const currentUser = UserStore.getCurrentUser();
        if (!currentUser) return;

        const userNames = [currentUser.username];
        if (currentUser.globalName) userNames.push(currentUser.globalName);

        const fontFamily = fontMap[settings.store.font] || fontMap["gg-sans"];

        const selectors: string[] = [];

        try {
            const { username, discriminator } = UserClasses;
            const { title, container } = TitleClasses;

            if (username) {
                selectors.push(`.${username}`);
            }
            if (discriminator) {
                selectors.push(`.${discriminator}`);
            }
            if (title) {
                selectors.push(`.${title}`);
            }
            if (container) {
                selectors.push(`.${container}`);
            }
        } catch (error) {
            // Classes not found yet, will use fallback
        }

        // Always include fallback selectors in case classes aren't found or selectors are empty
        const errSelectors = [
            "[class*=\"username\"]",
            "[class*=\"discriminator\"]",
            "[class*=\"title\"]"
        ];

        // Use data-is-self attribute from ThemeAttributes plugin if available
        const dataAttributeSelectors = [
            "[data-is-self=\"true\"] [class*=\"username\"]",
            "[data-is-self=\"true\"] [class*=\"title\"]",
            "[data-author-username]"
        ];

        // Combine all approaches
        const allSelectors = [...selectors, ...errSelectors, ...dataAttributeSelectors];

        allSelectors.forEach(selector => {
            try {
                const elements = document.querySelectorAll(selector);
                elements.forEach((el: Element) => {
                    // Check if element has data-is-self or matches username
                    const hasDataIsSelf = (el.closest("[data-is-self=\"true\"]") !== null);
                    const dataAuthorUsername = (el.closest("[data-author-username]") as HTMLElement)?.dataset.authorUsername;
                    const text = el.textContent?.trim();

                    // Match if: has data-is-self, or data-author-username matches, or text matches
                    const shouldApply = hasDataIsSelf ||
                        (dataAuthorUsername && userNames.includes(dataAuthorUsername)) ||
                        (text && userNames.some(name => text.includes(name)));

                    if (shouldApply) {
                        (el as HTMLElement).style.setProperty("font-family", fontFamily, "important");
                    }
                });
            } catch (err) {
                // Invalid selector, skip
            }
        });
    }
});
