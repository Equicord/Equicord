/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export function getNative() {
    if (IS_WEB) return null;

    const native = Object.values(VencordNative.pluginHelpers)
        .find(m => (m as any).bluGuildExportNativeMarker);

    return native as {
        saveFile: (baseDir: string, subPath: string, data: Uint8Array | string) => Promise<void>;
        fetchAsset: (url: string) => Promise<Uint8Array | null>;
    } | null;
}
