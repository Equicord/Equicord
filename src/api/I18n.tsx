/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findByPropsLazy } from "@webpack";
import { LocaleStore, React, useEffect } from "@webpack/common";
import { useForceUpdater } from "@utils/react";

import jaMessages from "../utils/translations/ja.json";

type Messages = Record<string, string>;

const dictionaries: Record<string, Messages> = {};
let currentLocale = "en";
let subscribed = false;

const localeChangeListeners = new Set<() => void>();

addMessages("ja", jaMessages as Messages);

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

    currentLocale = readLocaleFromStore();

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

export function setLocale(locale: string): void {
    currentLocale = locale;
    localeChangeListeners.forEach(cb => { try { cb(); } catch { } });
}

export function getLocale(): string {
    return currentLocale;
}

export function t(key: string, fallback?: string): string {
    const messages = dictionaries[currentLocale];
    if (messages && key in messages) return messages[key];
    return fallback ?? key;
}

export function useTranslation(): { t: typeof t; locale: string; } {
    const forceUpdate = useForceUpdater();

    useEffect(() => {
        const unsub = subscribe(() => forceUpdate());

        const onMountLocale = readLocaleFromStore();
        if (onMountLocale !== currentLocale) {
            currentLocale = onMountLocale;
            forceUpdate();
        }

        return unsub;
    }, []);

    return { t, locale: currentLocale };
}

export function Translate({ k, fallback }: { k: string; fallback?: string; }) {
    const { t } = useTranslation();
    return <>{t(k, fallback)}</>;
}

/**
 * Derive the i18n translation key prefix for a plugin from its folder path.
 * e.g. "src/equicordplugins/messageTranslate" → "equicord.plugins.messageTranslate"
 */
export function pluginI18nKey(folderName: string): string {
    const folder = folderName.replace(/^src\/(?:equicord)?plugins\//, "").replace(/\.\w+$/, "");
    return `equicord.plugins.${folder}`;
}
