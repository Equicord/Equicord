/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import ErrorBoundary from "@components/ErrorBoundary";
import { closeModal, openModal } from "@webpack/common";

import type { PageEntry } from "../api/types";
import { Palette } from "./Palette";

const SafePalette = ErrorBoundary.wrap(Palette, { noop: true });

let activeKey: string | null = null;

export function isPaletteOpen() {
    return activeKey !== null;
}

export function closePalette() {
    if (activeKey) {
        closeModal(activeKey);
        activeKey = null;
    }
}

export function openPalette(initialPage?: PageEntry) {
    if (activeKey) closePalette();

    const key = openModal(
        () => <SafePalette onClose={closePalette} initialPage={initialPage} />,
        {
            onCloseCallback() {
                if (activeKey === key) activeKey = null;
            }
        }
    );
    activeKey = key;
}

export function togglePalette() {
    if (activeKey) closePalette();
    else openPalette();
}
