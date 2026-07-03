/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { parseUrl } from "@utils/misc";
import type { ClipboardEvent } from "react";

export function tryMaskedLinkPaste(
    e: ClipboardEvent<HTMLTextAreaElement>,
    value: string,
    onUpdate: (next: string) => void
): boolean {
    const pasted = e.clipboardData?.getData("text/plain");
    if (!pasted) return false;

    const trimmed = pasted.trim();
    if (!trimmed || !parseUrl(trimmed)) return false;

    const el = e.currentTarget;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (start === null || end === null || start === end) return false;

    const selected = value.slice(start, end);
    if (!selected) return false;

    e.preventDefault();
    e.stopPropagation();

    const masked = `[${selected}](${trimmed})`;
    const next = value.slice(0, start) + masked + value.slice(end);
    onUpdate(next);

    const cursor = start + masked.length;
    requestAnimationFrame(() => el.setSelectionRange(cursor, cursor));

    return true;
}
