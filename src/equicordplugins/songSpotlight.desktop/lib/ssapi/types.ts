/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface Song {
    service: string;
    type: string;
    id: string;
}

export type UserData = Song[];

export interface SongParser {
    name: string;
    label: string;
    hosts: string[];
    parse(link: string, host: string, path: string[]): Promise<Song | null> | Song | null;
}

export interface RenderInfoBase {
    label: string;
    sublabel: string;
    explicit: boolean;
    link: string;
}

export interface RenderInfoEntry {
    audio?: {
        duration: number;
        previewUrl: string;
    };
}

export type RenderInfoEntryBased = RenderInfoEntry & RenderInfoBase;

export interface RenderSongSingle extends RenderInfoBase {
    form: "single";
    thumbnailUrl?: string;
    single: RenderInfoEntry;
}

export interface RenderSongList extends RenderInfoBase {
    form: "list";
    thumbnailUrl?: string;
    list: RenderInfoEntryBased[];
}

export type RenderSongInfo = RenderSongSingle | RenderSongList;

export interface SongService extends SongParser {
    types: string[];
    render(type: string, id: string): Promise<RenderSongInfo | null> | RenderSongInfo | null;
    validate(type: string, id: string): Promise<boolean> | boolean;
}
