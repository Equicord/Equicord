/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Embed, Message, MessageAttachment, MessageReaction, UserJSON } from "@vencord/discord-types";

export declare namespace Discord {
    export type StickerItem = Message["stickerItems"][number];

    export interface Attachment extends MessageAttachment {
        sensitive: boolean;
    }

    export interface Reaction extends MessageReaction {
        burst_colors: string[];
        borst_count: number;
        count_details: { burst: number; normal: number; };
        me_burst: boolean;
    }
}

export declare namespace HolyNotes {
    export interface Note {
        id: string;
        channel_id: string;
        guild_id: string;
        content: string;
        author: Pick<UserJSON, "id" | "avatar" | "discriminator" | "username">;
        flags: number;
        timestamp: string;
        attachments: Discord.Attachment[];
        embeds: Embed[];
        reactions: Discord.Reaction[];
        stickerItems: Discord.StickerItem[];
    }
}
