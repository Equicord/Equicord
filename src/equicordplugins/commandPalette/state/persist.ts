/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";

import { notifyPaletteChange } from "../api/registry";

export function createPersistedValue<T>(key: string, fallback: T) {
    const fullKey = `CommandPalette_${key}`;
    let value = fallback;

    return {
        async load() {
            const stored = await DataStore.get<T>(fullKey);
            if (stored !== undefined) value = stored;
        },
        get(): T {
            return value;
        },
        set(next: T) {
            value = next;
            void DataStore.set(fullKey, next);
            notifyPaletteChange();
        }
    };
}
