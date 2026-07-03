/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { PaletteCommand } from "../api/types";
import { getAlias } from "../state/aliases";
import { frecencyScore } from "../state/frecency";
import { isPinned } from "../state/pins";

export function fuzzyScore(query: string, text: string): number {
    const q = query.toLowerCase().trim();
    const t = text.toLowerCase();
    if (!q || !t) return 0;

    if (t === q) return 1000;
    if (t.startsWith(q)) return 800 + Math.max(0, 60 - t.length);

    const wordIndex = t.indexOf(" " + q);
    if (wordIndex !== -1) return 650 - Math.min(wordIndex, 100);

    const subIndex = t.indexOf(q);
    if (subIndex !== -1) return 450 - Math.min(subIndex, 200);

    let ti = 0;
    let first = -1;
    for (const char of q) {
        ti = t.indexOf(char, ti);
        if (ti === -1) return 0;
        if (first === -1) first = ti;
        ti += 1;
    }
    const span = ti - first;
    const density = q.length / span;
    return 100 + Math.round(density * 100);
}

export interface RankedCommand {
    command: PaletteCommand;
    score: number;
}

export function rankCommands(query: string, commands: PaletteCommand[]): RankedCommand[] {
    const ranked: RankedCommand[] = [];

    for (const command of commands) {
        let score = fuzzyScore(query, command.title);

        const alias = getAlias(command.id);
        if (alias) score = Math.max(score, fuzzyScore(query, alias) * 1.3);

        for (const keyword of command.keywords ?? []) {
            score = Math.max(score, fuzzyScore(query, keyword) * 0.7);
        }
        if (command.subtitle) score = Math.max(score, fuzzyScore(query, command.subtitle) * 0.4);
        score = Math.max(score, fuzzyScore(query, command.section) * 0.3);

        if (score <= 0) continue;

        score += frecencyScore(command.id) * 8;
        if (isPinned(command.id)) score += 40;
        ranked.push({ command, score });
    }

    return ranked.sort((a, b) => b.score - a.score);
}

export function filterOptions(query: string, options: { label: string; value: string; }[], limit = 6) {
    const trimmed = query.trim();
    if (!trimmed) return options.slice(0, limit);

    return options
        .map(option => ({ option, score: fuzzyScore(trimmed, option.label) }))
        .filter(entry => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(entry => entry.option);
}
