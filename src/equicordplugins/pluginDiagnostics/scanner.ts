/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// ─── Layer 1: Scanner (data extraction ONLY — no scoring, no rendering) ──────
// One synchronous pass over the live plugin registry. Reads existing in-memory
// structures only. No loops, no listeners, no persistent allocations.

import { isPluginEnabled } from "@api/PluginManager";

export interface RawPluginStat {
    name: string;
    patches: number;     // webpack code patches
    listeners: number;   // Flux/Dispatcher subscriptions
    uiInjects: number;   // context menus + UI render surfaces
    hooks: number;       // slash commands
}

// UI render factories a plugin can expose — each present one = a UI injection.
const UI_RENDER_PROPS = [
    "renderChatBarButton",
    "renderMessageAccessory",
    "renderMessagePopoverButton",
    "renderMemberListDecorator",
    "renderNicknameIcon",
    "renderMessageDecoration",
] as const;

// Read the registry lazily at call time (avoids any static circular import).
function getRegistry(): Record<string, any> {
    return (window as any).Vencord?.Plugins?.plugins ?? {};
}

/** Single synchronous snapshot of every enabled plugin's footprint. */
export function scanPlugins(): RawPluginStat[] {
    const registry = getRegistry();
    const out: RawPluginStat[] = [];

    for (const name of Object.keys(registry)) {
        let enabled = false;
        try { enabled = isPluginEnabled(name); } catch { enabled = false; }
        if (!enabled) continue;

        const p = registry[name];
        if (!p) continue;

        try {
            const patches = Array.isArray(p.patches) ? p.patches.length : 0;
            const listeners = p.flux ? Object.keys(p.flux).length : 0;
            let uiInjects = p.contextMenus ? Object.keys(p.contextMenus).length : 0;
            for (const key of UI_RENDER_PROPS) if (typeof p[key] === "function") uiInjects++;
            const hooks = Array.isArray(p.commands) ? p.commands.length : 0;
            out.push({ name, patches, listeners, uiInjects, hooks });
        } catch {
            // a plugin with an unexpected shape must never break the whole scan
            out.push({ name, patches: 0, listeners: 0, uiInjects: 0, hooks: 0 });
        }
    }
    return out;
}

/** Optional single heap sample in MB. Returns null if the API is unavailable. */
export function sampleHeapMB(): number | null {
    try {
        const used = (performance as any).memory?.usedJSHeapSize;
        return typeof used === "number" ? Math.round(used / 1048576) : null;
    } catch {
        return null;
    }
}
