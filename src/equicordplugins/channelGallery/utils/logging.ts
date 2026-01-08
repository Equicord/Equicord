/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/* ============================================================
 * SECTION ChannelGallery Logging Utilities
 * ============================================================ */

/* ------------------------------------------------------------
 * INFO Sections
 * ------------------------------------------------------------ */
export type LogSection =
    | "grid"
    | "layout"
    | "render"
    | "data"
    | "perf"
    | "lifecycle"
    | "settings"
    | "all";

/* ------------------------------------------------------------
 * INFO Levels
 * ------------------------------------------------------------ */
type LogLevel = "info" | "debug" | "warn" | "error";

/* ------------------------------------------------------------
 * INFO Prevent tree-shaking
 * ------------------------------------------------------------ */
(globalThis as any).__CHANNEL_GALLERY_DEBUG_LOADED__ = true;

/* ------------------------------------------------------------
 * INFO Debug flag reader
 * ------------------------------------------------------------ */
function getDebugState(): any {
    return (globalThis as any).__CHANNEL_GALLERY_DEBUG__;
}

/* ------------------------------------------------------------
 * INFO Debug enable check
 * ------------------------------------------------------------ */
function isDebugEnabled(section: LogSection): boolean {
    const dbg = getDebugState();

    if (!dbg) return false;
    if (dbg === true) return true;

    if (typeof dbg === "object") {
        if (dbg.all) return true;
        return Boolean(dbg[section]);
    }

    return false;
}

/* ============================================================
 * SECTION Styling
 * ============================================================ */

const BASE_PILL =
    "padding:2px 6px;border-radius:999px;font-weight:600;font-size:11px;";

/* Core pills */
const EQUICORD_PILL =
    BASE_PILL + "background:#a6da95;color:#111;";

const PLUGIN_PILL =
    BASE_PILL + "background:#8aadf4;color:#111;margin-left:4px;";

/* Level pills */
const LEVEL_PILLS: Record<LogLevel, string> = {
    info: BASE_PILL + "background:#91d7e3;color:#111;margin-left:4px;",
    debug: BASE_PILL + "background:#f5a97f;color:#111;margin-left:4px;",
    warn: BASE_PILL + "background:#eed49f;color:#111;margin-left:4px;",
    error: BASE_PILL + "background:#ed8796;color:#111;margin-left:4px;"
};

/* Special pills */
const PERF_PILL =
    BASE_PILL + "background:#c6a0f6;color:#111;margin-left:4px;";

const ASSERT_PILL =
    BASE_PILL + "background:#ed8796;color:#111;margin-left:4px;";

/* Section colors */
const SECTION_COLORS: Record<LogSection, string> = {
    grid: "#8aadf4",
    layout: "#a6da95",
    render: "#f5a97f",
    data: "#eed49f",
    perf: "#c6a0f6",
    lifecycle: "#c6a0f6",
    settings: "#91d7e3",
    all: "#b7bdf8"
};

function sectionPill(section: LogSection): string {
    return (
        BASE_PILL +
        `background:${SECTION_COLORS[section] ?? "#b7bdf8"};` +
        "color:#111;margin-left:4px;"
    );
}

/* ============================================================
 * SECTION Core emitter
 * ============================================================ */

function emit(
    level: LogLevel,
    section: LogSection,
    message: string,
    data?: unknown
): void {
    if (level === "debug" && !isDebugEnabled(section)) return;

    const prefix =
        "%cEquicord%c " +
        "%cChannelGallery%c " +
        "%c" + level.toUpperCase() + "%c " +
        "%c" + section + "%c " +
        message;

    const styles: string[] = [
        EQUICORD_PILL,
        "color:inherit",
        PLUGIN_PILL,
        "color:inherit",
        LEVEL_PILLS[level],
        "color:inherit",
        sectionPill(section),
        "color:inherit"
    ];

    const fn =
        level === "warn"
            ? console.warn
            : level === "error"
                ? console.error
                : console.log;

    if (data !== undefined) {
        fn(prefix, ...styles, data);
    } else {
        fn(prefix, ...styles);
    }
}

/* ============================================================
 * SECTION Perf helpers
 * ============================================================ */

const perfTimers = new Map<string, number>();

function perfStart(name: string): void {
    if (!isDebugEnabled("perf")) return;
    perfTimers.set(name, performance.now());
}

function perfEnd(name: string, extra?: unknown): void {
    if (!isDebugEnabled("perf")) return;

    const start = perfTimers.get(name);
    if (start === undefined) return;

    perfTimers.delete(name);

    const duration = performance.now() - start;

    const prefix =
        "%cEquicord%c %cChannelGallery%c %cPERF%c %cperf%c " +
        `${name} (${duration.toFixed(2)} ms)`;

    const styles = [
        EQUICORD_PILL,
        "color:inherit",
        PLUGIN_PILL,
        "color:inherit",
        PERF_PILL,
        "color:inherit",
        sectionPill("perf"),
        "color:inherit"
    ];

    if (extra !== undefined) {
        console.log(prefix, ...styles, extra);
    } else {
        console.log(prefix, ...styles);
    }
}

/* ============================================================
 * SECTION Assertions
 * ============================================================ */

function assert(
    condition: unknown,
    section: LogSection,
    message: string,
    data?: unknown,
    hard = false
): void {
    if (!isDebugEnabled(section)) return;
    if (condition) return;

    const prefix =
        "%cEquicord%c %cChannelGallery%c %cASSERT%c %c" + section + "%c " + message;

    const styles = [
        EQUICORD_PILL,
        "color:inherit",
        PLUGIN_PILL,
        "color:inherit",
        ASSERT_PILL,
        "color:inherit",
        sectionPill(section),
        "color:inherit"
    ];

    console.error(prefix, ...styles, data);

    if (hard) {
        throw new Error(`[ChannelGallery ASSERT] ${message}`);
    }
}

/* ============================================================
 * SECTION Public API
 * ============================================================ */

export const log = {
    info(section: LogSection, message: string, data?: unknown) {
        emit("info", section, message, data);
    },

    debug(section: LogSection, message: string, data?: unknown) {
        emit("debug", section, message, data);
    },

    warn(section: LogSection, message: string, data?: unknown) {
        emit("warn", section, message, data);
    },

    error(section: LogSection, message: string, data?: unknown) {
        emit("error", section, message, data);
    },

    groupDebug(section: LogSection, title: string, fn: () => void) {
        if (!isDebugEnabled(section)) return;

        console.groupCollapsed(
            "%cEquicord%c %cChannelGallery%c %cDEBUG%c %c" + section + "%c " + title,
            EQUICORD_PILL,
            "color:inherit",
            PLUGIN_PILL,
            "color:inherit",
            LEVEL_PILLS.debug,
            "color:inherit",
            sectionPill(section),
            "color:inherit"
        );

        try {
            fn();
        } finally {
            console.groupEnd();
        }
    },

    /* Perf */
    perfStart,
    perfEnd,

    /* Assertions */
    assert
};
