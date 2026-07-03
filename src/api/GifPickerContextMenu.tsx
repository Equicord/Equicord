/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";
import { ContextMenuApi, FluxDispatcher, Menu, React } from "@webpack/common";
import type { ReactNode } from "react";

const logger = new Logger("GifPickerContextMenu");

export type GifPickerContextMenuItemFactory = (instance: any, e: React.MouseEvent) => ReactNode | void;

interface HandlerEntry {
    render: GifPickerContextMenuItemFactory;
    priority: number;
}

const handlers = new Map<string, HandlerEntry>();

/**
 * Register a context menu item factory for GIF picker items.
 * @param id      Unique ID, typically the plugin name.
 * @param render  Function that receives the GIF item and returns ReactNode(s) to inject.
 * @param priority Lower numbers appear first. Defaults to 0.
 */
export function addGifPickerContextMenuPatch(id: string, render: GifPickerContextMenuItemFactory, priority = 0) {
    handlers.set(id, { render, priority });
}

/**
 * Remove a previously registered context menu item factory.
 * @param id Unique ID used when registering.
 */
export function removeGifPickerContextMenuPatch(id: string) {
    handlers.delete(id);
}

/** @internal Called by ExtraContextMenusAPI to render the merged context menu. */
export function _openGifPickerContextMenu(e: React.MouseEvent, instance) {
    if (!handlers.size) return;

    const items: React.ReactNode[] = [];
    for (const [id, { render }] of Array.from(handlers).sort(([, a], [, b]) => a.priority - b.priority)) {
        try {
            const node = render(instance, e);
            if (node) items.push(node);
        } catch (err) {
            logger.error(`Failed to render context menu for ${id}`, err);
        }
    }

    if (!items.length) return;
    ContextMenuApi.openContextMenu(e, () => <GifPickerContextMenuRoot items={items} />);
}

function GifPickerContextMenuRoot({ items }: { items: React.ReactNode[]; }) {
    return (
        <Menu.Menu
            navId="gif-picker-context"
            onClose={() => FluxDispatcher.dispatch({ type: "CONTEXT_MENU_CLOSE" })}
            aria-label="GIF Options"
        >
            {items}
        </Menu.Menu>
    );
}
