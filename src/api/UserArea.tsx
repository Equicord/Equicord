/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import ErrorBoundary from "@components/ErrorBoundary";
import { findComponentByCodeLazy } from "@webpack";
import { useEffect, useState } from "@webpack/common";
import type { ComponentType, MouseEventHandler, ReactNode } from "react";

const PanelButton = findComponentByCodeLazy(".NONE,disabled:", ".PANEL_BUTTON") as ComponentType<UserAreaButtonProps>;

export interface UserAreaButtonProps {
    icon: ReactNode;
    tooltipText?: ReactNode;
    onClick?: MouseEventHandler<HTMLDivElement>;
    onContextMenu?: MouseEventHandler<HTMLDivElement>;
    className?: string;
    role?: string;
    "aria-label"?: string;
    "aria-checked"?: boolean;
    disabled?: boolean;
    plated?: boolean;
    redGlow?: boolean;
    orangeGlow?: boolean;
}

export interface UserAreaRenderProps {
    nameplate?: any;
    iconForeground?: string;
    hideTooltips?: boolean;
}

export type UserAreaButtonFactory = (props: UserAreaRenderProps) => ReactNode;

export interface UserAreaButtonData {
    render: UserAreaButtonFactory;
    icon: ComponentType<{ className?: string; }>;
    priority?: number;
}

interface ButtonEntry {
    render: UserAreaButtonFactory;
    priority: number;
}

export const UserAreaButton = PanelButton;

const buttons = new Map<string, ButtonEntry>();
const listeners = new Set<() => void>();

export function addUserAreaButton(id: string, render: UserAreaButtonFactory, priority = 0) {
    buttons.set(id, { render, priority });
    updateSortedButtons();
    listeners.forEach(l => l());
}

export function removeUserAreaButton(id: string) {
    buttons.delete(id);
    updateSortedButtons();
    listeners.forEach(l => l());
}

let sortedButtons: [string, ButtonEntry][] = [];

function updateSortedButtons() {
    sortedButtons = Array.from(buttons).sort(([, a], [, b]) => a.priority - b.priority);
}

function UserAreaButtons({ props }: { props: UserAreaRenderProps; }) {
    const [, forceUpdate] = useState(0);

    useEffect(() => {
        const listener = () => forceUpdate(n => n + 1);
        listeners.add(listener);
        return () => { listeners.delete(listener); };
    }, []);

    return sortedButtons.map(([id, { render }]) => (
        <ErrorBoundary noop key={id}>
            {render(props)}
        </ErrorBoundary>
    ));
}

export function _renderButtons(props: UserAreaRenderProps) {
    return [<UserAreaButtons key="vc-user-area-buttons" props={props} />];
}
