/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 aouad
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin from "@utils/types";
import { Devs } from "@utils/constants";

export default definePlugin({
    name: "VimMotions",
    description: "Adds vim-style motions.",
    authors: [Devs.auoad],
    patches: [],

    start() {
        document.addEventListener("keydown", handleKey, { capture: true });
        createStatusBar();
    },

    stop() {
        document.removeEventListener("keydown", handleKey, { capture: true });
        removeStatusBar();
    }
});

let mode: "normal" | "insert" = "insert";
let statusEl: HTMLDivElement | null = null;

function setMode(newMode: "normal" | "insert") {
    mode = newMode;
    if (statusEl) {
        statusEl.innerText = newMode === "normal" ? "-- NORMAL --" : "-- INSERT --";
        statusEl.style.color = newMode === "normal" ? "red" : "green";
    }
}

function createStatusBar() {
    if (statusEl) return;

    const el = document.createElement("div");
    el.style.marginLeft = "12px";
    el.style.fontFamily = "monospace";
    el.style.fontSize = "14px";
    el.style.fontWeight = "bold";
    el.style.color = "green";
    el.innerText = "-- INSERT --";

    const toolbar = document.querySelector('div[class*="toolbar"]');
    if (toolbar) {
        toolbar.prepend(el);
    } else {
        el.style.position = "fixed";
        el.style.top = "10px";
        el.style.left = "60px";
        document.body.appendChild(el);
    }

    statusEl = el;
}

function removeStatusBar() {
    statusEl?.remove();
    statusEl = null;
}

function getChatScroller(): HTMLElement | null {
    const inner = document.querySelector('[data-list-id="chat-messages"]');
    if (!inner) return null;
    return inner.closest("div[class*='scrollerBase']") as HTMLElement;
}

function handleKey(e: KeyboardEvent) {
    if (e.key === "Escape") {
        setMode("normal");
        e.preventDefault();
        return;
    }
    if (mode === "normal" && e.key === "i") {
        setMode("insert");
        e.preventDefault();
        return;
    }

    if (mode !== "normal") return;

    const scroller = getChatScroller();
    if (!scroller) return;

    switch (e.key) {
        case "j":
            scroller.scrollTop += 40;
            e.preventDefault();
            break;
        case "k":
            scroller.scrollTop -= 40;
            e.preventDefault();
            break;
        case "0":
            scroller.scrollTop = 0;
            e.preventDefault();
            break;
        case "$":
            scroller.scrollTop = scroller.scrollHeight;
            e.preventDefault();
            break;
    }
}
