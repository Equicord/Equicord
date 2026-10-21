/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { classNameFactory } from "@utils/css";
import { useEffect, useRef } from "@webpack/common";

import type { PaletteAction } from "../api/types";
import { PaletteIcon } from "./PaletteIcon";

const cl = classNameFactory("vc-cmdpal-");

interface ActionsPanelProps {
    actions: PaletteAction[];
    selectedIndex: number;
    onSelect(index: number): void;
    onRun(action: PaletteAction): void;
}

function PanelRow({ action, selected, index, onSelect, onRun }: {
    action: PaletteAction;
    selected: boolean;
    index: number;
    onSelect(index: number): void;
    onRun(action: PaletteAction): void;
}) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (selected) ref.current?.scrollIntoView({ block: "nearest" });
    }, [selected]);

    return (
        <div
            ref={ref}
            className={cl("panel-row", { "panel-row-selected": selected })}
            onMouseMove={() => { if (!selected) onSelect(index); }}
            onClick={() => onRun(action)}
        >
            <div className={cl("chip-wrap", "chip-wrap-sm")}>
                <PaletteIcon icon={action.icon} className={typeof action.icon === "string" ? cl("chip-img") : cl("panel-icon")} />
            </div>
            <span className={cl("panel-label")}>{action.label}</span>
        </div>
    );
}

export function ActionsPanel({ actions, selectedIndex, onSelect, onRun }: ActionsPanelProps) {
    return (
        <div className={cl("panel")}>
            <div className={cl("panel-title")}>Actions</div>
            <div className={cl("panel-list")}>
                {actions.map((action, i) => (
                    <PanelRow
                        key={action.id}
                        action={action}
                        index={i}
                        selected={i === selectedIndex}
                        onSelect={onSelect}
                        onRun={onRun}
                    />
                ))}
            </div>
        </div>
    );
}
