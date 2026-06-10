/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { createPersistedValue } from "./persist";

const hotkeys = createPersistedValue<Record<string, string[]>>("hotkeys", {});

export const loadHotkeys = hotkeys.load;

export function getHotkey(commandId: string): string[] | undefined {
    return hotkeys.get()[commandId];
}

export function getAllHotkeys(): Record<string, string[]> {
    return hotkeys.get();
}

export function setHotkey(commandId: string, combo: string[] | null) {
    const next = { ...hotkeys.get() };
    if (combo?.length) next[commandId] = combo;
    else delete next[commandId];
    hotkeys.set(next);
}
