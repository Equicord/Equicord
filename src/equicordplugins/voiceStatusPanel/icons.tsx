/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export function MutedIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24">
            <path d="M12 1a4 4 0 0 0-4 4v7a4 4 0 0 0 8 0V5a4 4 0 0 0-4-4z" fill="currentColor" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="currentColor" strokeWidth="2" fill="none" />
            <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="2" />
            <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
    );
}

export function DeafenedIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24">
            <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H3v-7zM21 14h-3a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h3v-7z" fill="currentColor" />
            <path d="M3 14v-2a9 9 0 0 1 18 0v2" stroke="currentColor" strokeWidth="2" fill="none" />
            <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
    );
}

export function XIcon() {
    return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M5 5l14 14M19 5 5 19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
    );
}

export function SelectIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="2" />
            <path d="M7 12.5l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export function SpeakerIcon({ width = 16, height = 16 }: { width?: number; height?: number; }) {
    return (
        <svg width={width} height={height} viewBox="0 0 24 24">
            <path d="M3 9v6h4l5 5V4L7 9H3z" fill="currentColor" />
            <path d="M16 8a5.5 5.5 0 0 1 0 8M18.5 5.5a9 9 0 0 1 0 13" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
    );
}
