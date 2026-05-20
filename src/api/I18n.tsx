/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findByPropsLazy } from "@webpack";
import { React, useEffect, useState } from "@webpack/common";

import jaMessages from "../utils/translations/ja.json";

type Messages = Record<string, string>;
type LocaleMap = Record<string, Messages>;

const dictionaries: LocaleMap = {};
let currentLocale = detectLocale();

/* Load the bundled Japanese translation */
addMessages("ja", jaMessages as Messages);

/**
 * Discovers the user's locale from Discord's LocaleManager.
 * Falls back to `navigator.language` then "en".
 */
function detectLocale(): string {
    try {
        const LocaleModule = findByPropsLazy("getLocale");
        if (LocaleModule?.getLocale) {
            const locale = LocaleModule.getLocale() as string;
            if (locale && typeof locale === "string")
                return locale.split("-")[0] ?? locale;
        }
    } catch { /* fall through */ }

    try {
        const navLang = navigator.language;
        if (navLang) return navLang.split("-")[0] ?? navLang;
    } catch { /* fall through */ }

    return "en";
}

/**
 * Register a set of translation messages for a locale.
 * Merges with any existing messages for that locale.
 */
export function addMessages(locale: string, messages: Messages): void {
    dictionaries[locale] = { ...dictionaries[locale], ...messages };
}

/**
 * Override the detected locale at runtime.
 */
export function setLocale(locale: string): void {
    currentLocale = locale;
}

/**
 * Return the current active locale string.
 */
export function getLocale(): string {
    return currentLocale;
}

/**
 * Translate a key to the current locale.
 *
 * @param key The dot-separated translation key.
 * @param fallback Optional fallback string if no translation is found.
 * @returns The translated string, the fallback, or the key itself.
 */
export function t(key: string, fallback?: string): string {
    const messages = dictionaries[currentLocale];
    if (messages && key in messages) return messages[key];
    return fallback ?? key;
}

/**
 * React hook that returns the translation function and current locale.
 */
export function useTranslation(): { t: typeof t; locale: string; } {
    const [, forceUpdate] = useState(0);

    useEffect(() => {
        /* Re-detect once after mount */
        const detected = detectLocale();
        if (detected !== currentLocale) {
            currentLocale = detected;
            forceUpdate({} as any);
        }
    }, []);

    return { t, locale: currentLocale };
}

/**
 * React component that renders the translation for a key.
 */
export function Translate({ k, fallback }: { k: string; fallback?: string; }) {
    return <>{t(k, fallback)}</>;
}
