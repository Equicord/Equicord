/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Embed, MessageAttachment, MessageReaction } from "@vencord/discord-types";
import { StickerFormatType } from "@vencord/discord-types/enums";

export interface NoteAuthor {
    id: string;
    avatar: string;
    discriminator: string;
    username: string;
}

export interface NoteStickerItem {
    format_type: StickerFormatType;
    id: string;
    name: string;
}

export interface Note {
    id: string;
    channel_id: string;
    guild_id: string;
    content: string;
    author: NoteAuthor;
    flags: number;
    timestamp: string;
    attachments: MessageAttachment[];
    embeds: Embed[];
    reactions: MessageReaction[];
    stickerItems: NoteStickerItem[];
}

export type Notebook = Record<string, Note>;
export type AllNotebooks = Record<string, Notebook>;
