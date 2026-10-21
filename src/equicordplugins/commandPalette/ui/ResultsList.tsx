/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { classNameFactory } from "@utils/css";
import { useEffect, useRef } from "@webpack/common";
import type { ReactNode } from "react";

import type { PaletteAction, PaletteIcon as PaletteIconType } from "../api/types";
import { PaletteIcon } from "./PaletteIcon";

const cl = classNameFactory("vc-cmdpal-");

export interface RowItem {
    id: string;
    label: string;
    sublabel?: string;
    icon?: PaletteIconType;
    actions: PaletteAction[];
    accessory?: ReactNode;
    commandId?: string;
}

export interface ResultSection {
    label: string | null;
    items: RowItem[];
}

interface ResultsListProps {
    sections: ResultSection[];
    selectedIndex: number;
    onSelect(index: number): void;
    onRun(item: RowItem): void;
}

export function flattenSections(sections: ResultSection[]): RowItem[] {
    return sections.flatMap(section => section.items);
}

function Row({ item, selected, index, onSelect, onRun }: {
    item: RowItem;
    selected: boolean;
    index: number;
    onSelect(index: number): void;
    onRun(item: RowItem): void;
}) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (selected) ref.current?.scrollIntoView({ block: "nearest" });
    }, [selected]);

    return (
        <div
            ref={ref}
            className={cl("row", { "row-selected": selected })}
            onMouseMove={() => { if (!selected) onSelect(index); }}
            onClick={() => onRun(item)}
        >
            <div className={cl("chip-wrap")}>
                <PaletteIcon icon={item.icon} className={typeof item.icon === "string" ? cl("chip-img") : cl("row-icon")} />
            </div>
            <div className={cl("row-text")}>
                <span className={cl("row-label")}>{item.label}</span>
                {item.sublabel && <span className={cl("row-sublabel")}>{item.sublabel}</span>}
            </div>
            {item.accessory != null && <div className={cl("row-accessory")}>{item.accessory}</div>}
        </div>
    );
}

export function ResultsList({ sections, selectedIndex, onSelect, onRun }: ResultsListProps) {
    let index = -1;

    return (
        <div className={cl("results")}>
            {sections.map(section => (
                <div key={section.label ?? "default"} className={cl("section")}>
                    {section.label && <div className={cl("section-label")}>{section.label}</div>}
                    {section.items.map(item => {
                        index += 1;
                        const itemIndex = index;
                        return (
                            <Row
                                key={item.id}
                                item={item}
                                index={itemIndex}
                                selected={itemIndex === selectedIndex}
                                onSelect={onSelect}
                                onRun={onRun}
                            />
                        );
                    })}
                </div>
            ))}
            {sections.length === 0 && (
                <div className={cl("empty")}>No results</div>
            )}
        </div>
    );
}
