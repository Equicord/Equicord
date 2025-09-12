/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin from "@utils/types";

// Update-friendly: target Discord "name_" blocks
const SELECTORS = [
    '[class^="name_"]',
    '[class*=" name_"]'
].join(", ");

// Uppercase the first *letter* after any leading symbols/emojis/spaces
function capitalizeFirstAlpha(s: string): string {
    // ^  start
    // (...) group1 = any leading spaces/symbols/punctuation/emojis (Unicode Symbol category)
    // (\p{L}) group2 = first letter (any language)
    return s.replace(/^([\p{Z}\p{S}\p{P}\s]*)(\p{L})/u, (_, lead: string, letter: string) => {
        return lead + letter.toUpperCase();
    });
}

function sanitizeLabel(text: string): string {
    let n = text;

    // Replace hyphens with spaces
    n = n.replace(/-/g, " ");

    // Collapse/trim spacing (keeps a single space after bullets/emojis)
    n = n.replace(/\s+/g, " ").trim();

    // Only touch the first real letter
    n = capitalizeFirstAlpha(n);

    // Fallback just in case
    return n || text;
}

let observer: MutationObserver | null = null;
const pending = new Set<HTMLElement>();
let raf: number | null = null;

function scheduleFlush() {
    if (raf != null) return;
    raf = requestAnimationFrame(() => {
        raf = null;
        for (const el of pending) {
            try {
                const raw = el.textContent ?? "";
                if (!raw) continue;

                const cleaned = sanitizeLabel(raw);

                if (!el.dataset.ccnOrig) el.dataset.ccnOrig = raw;
                if (cleaned !== raw) {
                    el.textContent = cleaned;
                    if (el.hasAttribute("aria-label")) el.setAttribute("aria-label", cleaned);
                    if (el.hasAttribute("title")) el.setAttribute("title", cleaned);
                }
            } catch { /* ignore */ }
        }
        pending.clear();
    });
}

function queue(el: HTMLElement) {
    pending.add(el);
    scheduleFlush();
}

function scanExisting() {
    document.querySelectorAll<HTMLElement>(SELECTORS).forEach(queue);
}

export default definePlugin({
    name: "CleanerChannelNames",
    authors: [{ name: "7xeh", id: 785035260852830219n }],
    description: "Uppercase the first real letter and replace hyphens with spaces. Emojis stay.",
    start() {
        scanExisting();
        observer = new MutationObserver(muts => {
            for (const m of muts) {
                for (const node of m.addedNodes) {
                    if (!(node instanceof HTMLElement)) continue;
                    if (node.matches?.(SELECTORS)) queue(node);
                    node.querySelectorAll?.(SELECTORS).forEach(n => queue(n as HTMLElement));
                }
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    },
    stop() {
        observer?.disconnect();
        observer = null;
        document.querySelectorAll<HTMLElement>(SELECTORS).forEach(el => {
            const orig = el.dataset.ccnOrig;
            if (orig != null) {
                el.textContent = orig;
                if (el.hasAttribute("aria-label")) el.setAttribute("aria-label", orig);
                if (el.hasAttribute("title")) el.setAttribute("title", orig);
                delete el.dataset.ccnOrig;
            }
        });
        pending.clear();
    }
});
