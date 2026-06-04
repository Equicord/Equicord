/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export type Category =
    | "sponsor"
    | "selfpromo"
    | "interaction"
    | "intro"
    | "outro"
    | "preview"
    | "hook"
    | "filler"
    | "music_offtopic";

export type Segment = {
    segment: [number, number];
    category: Category;
};

export type CategoryAction = "skip" | "progress" | "manual" | "none";
export type CategorySetting =
    | "sponsorAction"
    | "selfPromoAction"
    | "interactionAction"
    | "introAction"
    | "outroAction"
    | "previewAction"
    | "hookAction"
    | "tangentsJokesAction"
    | "musicOfftopicAction";

export type IframeProps = {
    src?: unknown;
    onLoad?: (event: Event) => void;
    onMouseEnter?: (event: React.MouseEvent<HTMLIFrameElement>) => void;
    onMouseLeave?: (event: React.MouseEvent<HTMLIFrameElement>) => void;
    onMouseMove?: (event: React.MouseEvent<HTMLIFrameElement>) => void;
    onPointerMove?: (event: React.PointerEvent<HTMLIFrameElement>) => void;
    [key: string]: unknown;
};

export type Controller = {
    iframe: HTMLIFrameElement;
    videoId: string;
    segments: Segment[];
    interval: number;
    skipTimeout: number | undefined;
    currentTime: number;
    duration: number;
    lastTimeUpdate: number;
    playing: boolean;
    lastSkipAt: number;
    lastSkippedSegment: Segment | null;
    skippedSegments: Set<string>;
    listeners: Set<() => void>;
};
