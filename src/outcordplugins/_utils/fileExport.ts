/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export async function downloadToBuffer(url: string): Promise<Uint8Array | null> {
    try {
        const res = await fetch(url)
        if (!res.ok) return null
        return new Uint8Array(await res.arrayBuffer())
    } catch {
        return null
    }
}
