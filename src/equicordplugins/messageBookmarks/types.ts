/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export type BookmarkCategory = "general" | "important" | "later";

export interface Bookmark {
    id: string;
    messageId: string;
    channelId: string;
    guildId?: string | null;
    authorId: string;
    authorUsername: string;
    authorAvatar?: string | null;
    content: string;
    attachmentCount: number;
    timestamp: string;
    category: BookmarkCategory;
    savedAt: number;
}
