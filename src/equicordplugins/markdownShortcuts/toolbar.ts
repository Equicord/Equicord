/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { classNameFactory } from "@utils/css";

import { MarkdownFormat } from "./types";
import { applyFormatToSelection } from "./utils";

const cl = classNameFactory("vc-mdshortcuts-");
const TOOLBAR_CONTAINER_ID = "vc-mdshortcuts-container";

export function createToolbarButton(format: MarkdownFormat): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.className = cl("btn");
    btn.setAttribute("aria-label", format.toolbarLabel);
    btn.title = format.toolbarLabel;
    btn.innerHTML = format.toolbarIcon!;
    btn.addEventListener("mousedown", e => {
        e.preventDefault();
        e.stopPropagation();
    });

    btn.addEventListener("click", e => {
        e.preventDefault();
        e.stopPropagation();
        applyFormatToSelection(format);
    });

    return btn;
}

export function injectToolbarButtons(toolbar: HTMLElement, formats: MarkdownFormat[]) {
    if (toolbar.querySelector(`#${TOOLBAR_CONTAINER_ID}`)) return;

    const container = document.createElement("span");
    container.id = TOOLBAR_CONTAINER_ID;
    container.className = cl("container");

    for (const format of formats) {
        container.appendChild(createToolbarButton(format));
    }

    toolbar.appendChild(container);
}

export class ToolbarManager {
    static observer: MutationObserver | null = null;

    static start(formats: MarkdownFormat[]) {
        this.observer = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (!(node instanceof HTMLElement)) continue;

                    const toolbar = node.id === "slate-toolbar" ? node : node.querySelector("#slate-toolbar");
                    if (toolbar instanceof HTMLElement) {
                        injectToolbarButtons(toolbar, formats);
                    }
                }
            }
        });

        this.observer.observe(document.body, { childList: true, subtree: true });

        const existingToolbar = document.getElementById("slate-toolbar");
        if (existingToolbar) {
            injectToolbarButtons(existingToolbar, formats);
        }
    }

    static stop() {
        this.observer?.disconnect();
        this.observer = null;

        document.querySelectorAll(`#${TOOLBAR_CONTAINER_ID}`).forEach(el => el.remove());
    }
}
