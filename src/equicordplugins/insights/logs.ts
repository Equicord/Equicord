/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { LogEntry } from "./types";

let voiceLogs: LogEntry[] = [];
let logSubscriptions: (() => void)[] = [];

export function getLogs(): LogEntry[] {
    return voiceLogs;
}

export function addLogEntry(entry: LogEntry) {
    voiceLogs = [...voiceLogs, entry];
    logSubscriptions.forEach(fn => fn());
}

export function clearLogs() {
    voiceLogs = [];
    logSubscriptions.forEach(fn => fn());
}

export function logSubscribe(listener: () => void) {
    logSubscriptions = [...logSubscriptions, listener];
    return () => {
        logSubscriptions = logSubscriptions.filter(l => l !== listener);
    };
}
