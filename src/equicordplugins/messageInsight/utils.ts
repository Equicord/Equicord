/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export function sanitizeContent(content: string): string {
    return content
        .replace(/<a?:(\w+):\d+>/g, ":$1:")
        .replace(/<@!?(\d+)>/g, "@user")
        .replace(/<#\d+>/g, "#channel")
        .replace(/<@&\d+>/g, "@role")
        .replace(/\[([^\]]+)\]\(https?:\/\/cdn\.discordapp\.com\/emojis\/[^)]+\)/g, ":$1:")
        .replace(/<t:(\d+)(?::[tTdDfFR])?>/g, (_, ts) => {
            try { return new Date(parseInt(ts, 10) * 1000).toLocaleString(); } catch { return ts; }
        });
}

export function avatarUrl(author: { id: string; avatar?: string | null; }): string {
    if (!author?.avatar) {
        const index = Number(BigInt(author.id) >> 22n) % 6;
        return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
    }
    const ext = author.avatar.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${author.id}/${author.avatar}.${ext}?size=32`;
}

export function formatTime(timestamp: string | Date | undefined): string {
    if (!timestamp) return "";
    try {
        return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
        return "";
    }
}
