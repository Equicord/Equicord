/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { createPersistedValue } from "./persist";

const pins = createPersistedValue<string[]>("pins", []);

export const loadPins = pins.load;

export function getPins(): string[] {
    return pins.get();
}

export function isPinned(commandId: string): boolean {
    return pins.get().includes(commandId);
}

export function togglePin(commandId: string) {
    const current = pins.get();
    pins.set(current.includes(commandId)
        ? current.filter(id => id !== commandId)
        : [...current, commandId]);
}
