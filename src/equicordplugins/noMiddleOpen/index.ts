/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";

const MIDDLE_BUTTON = 1;

function shouldBlock(e: MouseEvent): boolean {
    if (e.button !== MIDDLE_BUTTON) return false;

    const target = e.target as HTMLElement | null;
    if (!target?.closest) return false;

    const a = target.closest("a[href]") as HTMLAnchorElement | null;
    if (!a) return false;

    const href = a.getAttribute("href");
    return !!href && href !== "#";
}

function handleAuxClick(e: MouseEvent) {
    if (!shouldBlock(e)) return;
    e.preventDefault();
    e.stopPropagation();
}

export default definePlugin({
    name: "NoMiddleOpen",
    description: "Prevents middle-click on links from opening new tabs while preserving autoscroll.",
    authors: [EquicordDevs.korzi],

    start() {
        document.addEventListener("auxclick", handleAuxClick, true);
    },

    stop() {
        document.removeEventListener("auxclick", handleAuxClick, true);
    }
});

