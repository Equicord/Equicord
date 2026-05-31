/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// ─── Layer 2: Processing (risk scoring + aggregation — pure, no I/O) ─────────

import type { RawPluginStat } from "./scanner";

export type RiskLevel = "low" | "medium" | "high";

export interface ScoredPlugin extends RawPluginStat {
    risk: number;
    level: RiskLevel;
}

/** riskScore = (patches*2) + (listeners*3) + (uiInjects*1.5) */
export function scorePlugin(s: RawPluginStat): ScoredPlugin {
    const risk = (s.patches * 2) + (s.listeners * 3) + (s.uiInjects * 1.5);
    const level: RiskLevel = risk <= 10 ? "low" : risk <= 25 ? "medium" : "high";
    return { ...s, risk: Math.round(risk * 10) / 10, level };
}

/** Score every row and pre-sort by risk (descending). */
export function processSnapshot(raw: RawPluginStat[]): ScoredPlugin[] {
    return raw.map(scorePlugin).sort((a, b) => b.risk - a.risk);
}
