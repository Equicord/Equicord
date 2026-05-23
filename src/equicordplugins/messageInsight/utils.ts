/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IconUtils, UserStore } from "@webpack/common";

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
    const user = UserStore.getUser(author.id);
    if (user) return IconUtils.getUserAvatarURL(user, false, 32);
    return IconUtils.getDefaultAvatarURL(author.id);
}

export function formatTime(timestamp: string | Date | undefined): string {
    if (!timestamp) return "";
    try {
        return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
        return "";
    }
}
