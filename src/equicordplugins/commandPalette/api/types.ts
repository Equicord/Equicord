/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { ComponentType, ReactNode } from "react";

export interface PaletteIconProps {
    className?: string;
}

export type PaletteIcon = ComponentType<PaletteIconProps> | string;

export interface PaletteContext {
    close(): void;
    pop(): void;
    push(entry: PageEntry): void;
    setQuery(query: string): void;
}

export interface PaletteAction {
    id: string;
    label: string;
    icon?: PaletteIcon;
    run(ctx: PaletteContext): void | Promise<void>;
    keepOpen?: boolean;
}

export interface PaletteCommand {
    id: string;
    title: string;
    subtitle?: string;
    icon?: PaletteIcon;
    section: string;
    keywords?: string[];
    predicate?(): boolean;
    actions?: PaletteAction[];
    page?(): PageEntry;
}

export interface PaletteListItem {
    id: string;
    label: string;
    sublabel?: string;
    icon?: PaletteIcon;
    keywords?: string[];
    actions: PaletteAction[];
}

export interface ListPageSpec {
    type: "list";
    placeholder?: string;
    items(query: string): PaletteListItem[] | Promise<PaletteListItem[]>;
}

export type FormValues = Record<string, string>;

export interface FormSubmitExtras {
    files?: Record<string, File[]>;
}

export interface FormFieldOption {
    value: string;
    label: string;
    icon?: PaletteIcon;
}

export interface FormField {
    key: string;
    label: string;
    type: "text" | "textarea" | "select" | "picker";
    placeholder?: string;
    initial?: string;
    options?: FormFieldOption[];
    suggestions?(query: string): FormFieldOption[];
    visible?(values: FormValues): boolean;
    markdown?: boolean;
    attachments?: boolean;
}

export interface FormPageSpec {
    type: "form";
    submitLabel?: string;
    fields: FormField[];
    validate?(values: FormValues, extras?: FormSubmitExtras): string | null;
    submit(values: FormValues, ctx: PaletteContext, extras?: FormSubmitExtras): void | Promise<void>;
}

export interface DetailRow {
    label: string;
    value: string;
}

export interface DetailPageSpec {
    type: "detail";
    heading: string;
    body?: ReactNode;
    rows?: DetailRow[];
    actions?: PaletteAction[];
}

export type PageSpec = ListPageSpec | FormPageSpec | DetailPageSpec;

export interface PageEntry {
    title: string;
    icon?: PaletteIcon;
    spec: PageSpec;
}
