/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface ScrollerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "dir"> {
    className?: string;
    style?: React.CSSProperties;
    children?: React.ReactNode;
    orientation?: "vertical" | "horizontal";
    paddingFix?: boolean;
    fade?: boolean;
    dir?: "ltr" | "rtl";
    onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
}

export interface ListScrollerProps {
    className?: string;
    style?: React.CSSProperties;
    dir?: "ltr" | "rtl";
    fade?: boolean;
    customTheme?: boolean;
    onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
    onResize?: ((entries: ResizeObserverEntry[]) => void) | null;
    onContentResize?: ((entries: ResizeObserverEntry[]) => void) | null;
    sections: number[];
    sectionHeight: number;
    rowHeight: number;
    footerHeight?: number;
    sidebarHeight?: number;
    listHeaderHeight?: number;
    renderSection?: (section: { type: string; section: number; }) => React.ReactNode;
    renderRow: (row: { type: string; section: number; row: number; }) => React.ReactNode;
    renderFooter?: (footer: { type: string; section: number; }) => React.ReactNode;
    renderSidebar?: (isListVisible: boolean, isSidebarVisible: boolean) => React.ReactNode;
    renderListHeader?: () => React.ReactNode;
    stickyListHeader?: boolean;
    wrapSection?: (section: number, children: React.ReactNode[]) => React.ReactNode;
    paddingTop?: number;
    paddingBottom?: number;
    chunkSize?: number;
    innerId?: string;
    innerRole?: string;
    innerAriaLabel?: string;
}
