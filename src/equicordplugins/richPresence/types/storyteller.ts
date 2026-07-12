/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface StorytellerAuthor {
    uuid: string;
    name: string;
    fileAs?: string;
}

export interface StorytellerNarrator {
    uuid: string;
    name: string;
    fileAs?: string;
}

export interface StorytellerSeries {
    uuid: string;
    name: string;
    position?: number;
}

export interface StorytellerLocator {
    href?: string;
    type?: string;
    locations?: {
        fragments?: string[];
        progression?: number;
        totalProgression?: number;
        position?: number;
    };
    target?: number;
}

export interface StorytellerPosition {
    uuid: string;
    locator: StorytellerLocator;
    timestamp: number;
    createdAt?: string;
    updatedAt?: string;
}

export interface StorytellerAudiobook {
    uuid: string;
    filepath?: string;
    missing?: boolean;
    duration?: number;
    fileSize?: number;
}

export interface StorytellerEbook {
    uuid: string;
    filepath?: string;
    missing?: boolean;
    pageCount?: number;
}

export interface StorytellerBook {
    uuid: string;
    title: string;
    language?: string | null;
    description?: string | null;
    publicationDate?: string | null;
    subtitle?: string | null;
    duration?: number | null;
    authors: StorytellerAuthor[];
    narrators: StorytellerNarrator[];
    series: StorytellerSeries[];
    position: StorytellerPosition | null;
    audiobook: StorytellerAudiobook | null;
    ebook: StorytellerEbook | null;
    status?: { name?: string } | null;
}

export interface StorytellerMediaData {
    name: string;
    author?: string;
    narrator?: string;
    series?: string;
    seriesPosition?: number;
    duration?: number;
    totalProgression?: number;
    imageUrl?: string;
    bookId: string;
}
