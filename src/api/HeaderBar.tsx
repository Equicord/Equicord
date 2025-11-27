/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import ErrorBoundary from "@components/ErrorBoundary";
import { useEffect, useState } from "@webpack/common";
import type { JSX } from "react";

export type HeaderBarButtonFactory = () => JSX.Element | null;

export const buttons = new Map<string, HeaderBarButtonFactory>();

const listeners = new Set<() => void>();

/**
 * Add a button to the header bar.
 * @param id Unique identifier for the button.
 * @param render Function that renders the button component.
 */
export function addHeaderBarButton(id: string, render: HeaderBarButtonFactory) {
    buttons.set(id, render);
    listeners.forEach(l => l());
}

/**
 * Remove a button from the header bar.
 * @param id The identifier of the button to remove.
 */
export function removeHeaderBarButton(id: string) {
    buttons.delete(id);
    listeners.forEach(l => l());
}

function HeaderBarButtons() {
    const [, forceUpdate] = useState(0);

    useEffect(() => {
        const listener = () => forceUpdate(n => n + 1);
        listeners.add(listener);
        return () => { listeners.delete(listener); };
    }, []);

    return Array.from(buttons, ([id, Button]) => (
        <ErrorBoundary noop key={id}>
            <Button />
        </ErrorBoundary>
    ));
}

export function _addButtons() {
    return [<HeaderBarButtons key="vc-header-bar-buttons" />];
}
