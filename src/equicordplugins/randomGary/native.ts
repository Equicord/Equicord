/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const allowedDomains = ["api.garythe.cat", "cdn.garythe.cat", "minky.materii.dev", "api.thecatapi.com"];

export async function getImageBuffer(_, url: string): Promise<Buffer | null> {
    try {
        const parsedUrl = new URL(url);

        if (!allowedDomains.includes(parsedUrl.hostname)) {
            return null;
        }

        const response = await fetch(parsedUrl.href);

        if (!response.ok) {
            return null;
        }

        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);

    } catch (error) {
        return null;
    }
}
