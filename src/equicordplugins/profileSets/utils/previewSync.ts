/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

let previewApplyGeneration = 0;
const listeners = new Set<() => void>();

export function getPreviewApplyGeneration() {
    return previewApplyGeneration;
}

export function subscribePreviewApply(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function notifyPreviewApply() {
    previewApplyGeneration++;
    for (const listener of listeners) listener();
}
