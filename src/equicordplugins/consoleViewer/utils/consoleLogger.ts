/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import settings from "../settings";

export interface LogEntry {
    timestamp: number;
    type: "log" | "info" | "warn" | "error";
    content: any;
    stack?: string;
}

const logs: LogEntry[] = [];
const originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error
};

const consoleLogEvent = new Event("console-captured");

const DEFAULT_MAX_LOG_ENTRIES = 1000;
let isInitialized = false;

export function startConsoleCapture() {
    isInitialized = true;

    // Wrap console methods
    console.log = function (...args) {
        captureLog("log", ...args);
        return originalConsole.log.apply(console, args);
    };

    console.info = function (...args) {
        captureLog("info", ...args);
        return originalConsole.info.apply(console, args);
    };

    console.warn = function (...args) {
        captureLog("warn", ...args);
        return originalConsole.warn.apply(console, args);
    };

    console.error = function (...args) {
        captureLog("error", ...args);
        return originalConsole.error.apply(console, args);
    };
}

export function stopConsoleCapture() {
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
}

function getSetting<T>(key: string, defaultValue: T): T {
    try {
        if (!isInitialized || !settings.store) return defaultValue;
        return settings.store[key] ?? defaultValue;
    } catch (e) {
        return defaultValue;
    }
}

function captureLog(type: "log" | "info" | "warn" | "error", ...args) {
    // Create log entry
    const entry: LogEntry = {
        timestamp: Date.now(),
        type,
        content: args.length === 1 ? args[0] : args,
    };

    if (type === "error" && args[0] instanceof Error) {
        entry.stack = args[0].stack;
    }

    logs.push(entry);

    const maxEntries = getSetting("maxLogEntries", DEFAULT_MAX_LOG_ENTRIES);
    if (maxEntries > 0 && logs.length > maxEntries) {
        logs.splice(0, logs.length - maxEntries);
    }

    window.dispatchEvent(consoleLogEvent);
}

export function getCapturedLogs(): LogEntry[] {
    return logs;
}

export function clearLogs() {
    logs.length = 0;
    window.dispatchEvent(consoleLogEvent);
}

export function downloadLogs() {
    const content = JSON.stringify(logs, null, 2);
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const filename = `console-logs-${new Date().toISOString().replace(/:/g, "-")}.json`;

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();

    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 60000);
}
