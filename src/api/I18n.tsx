/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findByPropsLazy } from "@webpack";
import { LocaleStore, React, useEffect, useState } from "@webpack/common";

import jaMessages from "../utils/translations/ja.json";

type Messages = Record<string, string>;

const dictionaries: Record<string, Messages> = {};
let currentLocale = "en";
let subscribed = false;

/* Callbacks that fire when the locale changes */
const localeChangeListeners = new Set<() => void>();

/* Load the bundled Japanese translation */
addMessages("ja", jaMessages as Messages);

/**
 * Register a set of translation messages for a locale.
 */
export function addMessages(locale: string, messages: Messages): void {
    dictionaries[locale] = { ...dictionaries[locale], ...messages };
}

function subscribe(callback: () => void): () => void {
    ensureSubscribed();
    localeChangeListeners.add(callback);
    return () => { localeChangeListeners.delete(callback); };
}

function ensureSubscribed(): void {
    if (subscribed) return;
    subscribed = true;

    currentLocale = detectLocale();

    if (typeof LocaleStore !== "undefined" && LocaleStore) {
        try {
            LocaleStore.addChangeListener(onLocaleChanged);
        } catch { /* LocaleStore not ready yet */ }
    }
}

function onLocaleChanged(): void {
    const newLocale = readLocaleFromStore();
    if (newLocale !== currentLocale) {
        currentLocale = newLocale;
        localeChangeListeners.forEach(cb => { try { cb(); } catch { } });
    }
}

function readLocaleFromStore(): string {
    try {
        if (typeof LocaleStore !== "undefined" && LocaleStore?.locale) {
            return (LocaleStore.locale as string).split("-")[0] ?? "en";
        }
    } catch { }
    return detectLocale();
}

/**
 * Detects the user's locale from Discord's LocaleStore.
 * Falls back to navigator.language then "en".
 */
function detectLocale(): string {
    try {
        if (typeof LocaleStore !== "undefined" && LocaleStore?.locale) {
            const locale = (LocaleStore.locale as string).split("-")[0] ?? LocaleStore.locale;
            if (locale && typeof locale === "string") return locale;
        }
    } catch { }

    try {
        const LocaleModule = findByPropsLazy("getLocale");
        if (LocaleModule?.getLocale) {
            const locale = LocaleModule.getLocale() as string;
            if (locale && typeof locale === "string")
                return locale.split("-")[0] ?? locale;
        }
    } catch { }

    try {
        const navLang = navigator.language;
        if (navLang) return navLang.split("-")[0] ?? navLang;
    } catch { }

    return "en";
}

/**
 * Override the detected locale at runtime.
 */
export function setLocale(locale: string): void {
    currentLocale = locale;
    localeChangeListeners.forEach(cb => { try { cb(); } catch { } });
}

/**
 * Return the current active locale string.
 */
export function getLocale(): string {
    return currentLocale;
}

/**
 * Translate a key to the current locale.
 * @param key The dot-separated translation key.
 * @param fallback Fallback string if no translation is found.
 * @returns The translated string, the fallback, or the key itself.
 */
export function t(key: string, fallback?: string): string {
    const messages = dictionaries[currentLocale];
    if (messages && key in messages) return messages[key];
    return fallback ?? key;
}

/**
 * React hook that returns the translation function and current locale.
 * Re-renders automatically when Discord's locale changes.
 */
export function useTranslation(): { t: typeof t; locale: string; } {
    const [, forceUpdate] = useState(0);

    useEffect(() => {
        const unsub = subscribe(() => {
            forceUpdate(n => n + 1);
        });

        /* Re-detect on mount to ensure we're in sync */
        const onMountLocale = readLocaleFromStore();
        if (onMountLocale !== currentLocale) {
            currentLocale = onMountLocale;
            forceUpdate(n => n + 1);
        }

        return unsub;
    }, []);

    return { t, locale: currentLocale };
}

/**
 * React component that renders the translation for a key.
 * Re-renders when locale changes.
 */
export function Translate({ k, fallback }: { k: string; fallback?: string; }) {
    const { t } = useTranslation();
    return <>{t(k, fallback)}</>;
}
