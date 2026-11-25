/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export let initialQuestDataFetched = false;
let settingsModalOpen = false;
const injectedDesktopVideoTasks = new WeakSet<object>();

export function setInitialQuestDataFetched(fetched: boolean): void {
    initialQuestDataFetched = fetched;
}

export function setSettingsModalOpen(open: boolean): void {
    settingsModalOpen = open;
}

export function getSettingsModalOpen(): boolean {
    return settingsModalOpen;
}

export function markInjectedDesktopVideoTask(task: object): void {
    injectedDesktopVideoTasks.add(task);
}

export function isInjectedDesktopVideoTask(task?: object | null): boolean {
    return Boolean(task && injectedDesktopVideoTasks.has(task));
}
