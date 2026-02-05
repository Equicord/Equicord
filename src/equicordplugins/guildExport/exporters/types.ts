/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface ExporterContext {
    guildId: string;
    actionDelay: number;
    filenameFormat: "IDs" | "Names";
    save: (path: string, data: Uint8Array | string) => Promise<void>;
    logger: any;
    setProgress: (status: string, type?: string) => void;
}

export type ExporterFunc = (ctx: ExporterContext) => Promise<void>;
