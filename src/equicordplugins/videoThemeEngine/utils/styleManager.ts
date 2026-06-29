/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { SettingsStore } from "@api/Settings";
import { managedStyleRootNode } from "@api/Styles";
import { createAndAppendStyle } from "@utils/css";

import { settings } from "../settings";
import { BASE_STYLE_ID, SETTINGS_PREFIX, UI_STYLE_ID, type UiSettings } from "./constants";
import { buildBaseCss, buildUiCss } from "./css";

const styleCache = {
    base: null as HTMLStyleElement | null,
    ui: null as HTMLStyleElement | null,
};

let settingsChangeHandler: ((_v: unknown, _path: string) => void) | null = null;
let applyRaf = 0;

function getOrCreateStyle(id: string): HTMLStyleElement {
    if (id === BASE_STYLE_ID) {
        if (!styleCache.base) {
            styleCache.base = createAndAppendStyle(BASE_STYLE_ID, managedStyleRootNode);
        }
        return styleCache.base;
    }
    if (!styleCache.ui) {
        styleCache.ui = createAndAppendStyle(UI_STYLE_ID, managedStyleRootNode);
    }
    return styleCache.ui;
}

export function applyUiStyles(): void {
    getOrCreateStyle(BASE_STYLE_ID).textContent = buildBaseCss();
    getOrCreateStyle(UI_STYLE_ID).textContent = buildUiCss(settings.store as UiSettings);
}

export function removeUiStyles(): void {
    styleCache.base?.remove();
    styleCache.ui?.remove();
    styleCache.base = null;
    styleCache.ui = null;
}

function applyLivePreview(): void {
    if (applyRaf) cancelAnimationFrame(applyRaf);
    applyRaf = requestAnimationFrame(() => {
        applyRaf = 0;
        applyUiStyles();
    });
}

export function startSettingsListener(): void {
    settingsChangeHandler ??= () => applyLivePreview();
    SettingsStore.addPrefixChangeListener(SETTINGS_PREFIX, settingsChangeHandler);
}

export function stopSettingsListener(): void {
    if (settingsChangeHandler) {
        SettingsStore.removePrefixChangeListener(SETTINGS_PREFIX, settingsChangeHandler);
        settingsChangeHandler = null;
    }
    if (applyRaf) {
        cancelAnimationFrame(applyRaf);
        applyRaf = 0;
    }
}
