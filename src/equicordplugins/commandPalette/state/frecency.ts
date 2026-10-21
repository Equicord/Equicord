/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { createPersistedValue } from "./persist";

interface UsageEntry {
    count: number;
    last: number;
}

const usage = createPersistedValue<Record<string, UsageEntry>>("frecency", {});

const DAY = 86_400_000;

export const loadFrecency = usage.load;

export function recordUse(commandId: string) {
    const next = { ...usage.get() };
    const entry = next[commandId];
    next[commandId] = { count: (entry?.count ?? 0) + 1, last: Date.now() };
    usage.set(next);
}

export function frecencyScore(commandId: string): number {
    const entry = usage.get()[commandId];
    if (!entry) return 0;

    const age = Date.now() - entry.last;
    const recency = age < DAY ? 1 : age < 7 * DAY ? 0.6 : age < 30 * DAY ? 0.3 : 0.1;
    return Math.min(entry.count, 20) * recency;
}

export function topFrecent(limit: number): string[] {
    return Object.entries(usage.get())
        .sort((a, b) => frecencyScore(b[0]) - frecencyScore(a[0]))
        .slice(0, limit)
        .map(([id]) => id);
}
