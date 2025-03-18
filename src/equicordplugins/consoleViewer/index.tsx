/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { EquicordDevs } from "@utils/constants";
import { LazyComponent } from "@utils/react";
import definePlugin from "@utils/types";
import { findByCode } from "@webpack";

import { ConsoleLogIcon } from "./components/ConsoleIcon";
import { openConsoleViewer } from "./components/ConsoleModal";
import settings from "./settings";
import { startConsoleCapture, stopConsoleCapture } from "./utils/consoleLogger";

type CommandReturnValue = any;
type Argument = any;
type CommandContext = any;

const HeaderBarIcon = LazyComponent(() => {
    const filter = ".Icon";
    return findByCode(filter);
});

export default definePlugin({
    name: "Console Viewer",
    description: "View and search console logs in a clean UI modal",
    authors: [EquicordDevs.SteelTech],
    dependencies: [],

    settings,

    commands: [{
        name: "console",
        description: "Open the console viewer",
        execute: (args: Argument[], ctx: CommandContext) => {
            openConsoleViewer();
            return {
                send: false,
                result: "Opened console viewer"
            } as CommandReturnValue;
        }
    }],

    patches: [],

    start() {
        setTimeout(() => {
            startConsoleCapture();

            if (settings.store?.iconLocation === "toolbar") {
                this.showToolbarIcon();
            } else {
                this.showToolbarIcon();
            }
        }, 0);
    },

    stop() {
        stopConsoleCapture();
        this.removeToolbarIcon();
    },

    showToolbarIcon() {
        const toolbar = document.querySelector(".toolbar-3_r2xA");
        if (!toolbar || document.querySelector(".console-viewer-btn")) return;

        const button = document.createElement("div");
        button.classList.add("console-viewer-btn", "iconWrapper-2awDjA", "clickable-ZD7xvu");
        button.innerHTML = ConsoleLogIcon();
        button.addEventListener("click", openConsoleViewer);
        button.setAttribute("role", "button");
        button.setAttribute("aria-label", "Console Viewer");
        button.setAttribute("tabindex", "0");

        toolbar.prepend(button);
    },

    removeToolbarIcon() {
        document.querySelector(".console-viewer-btn")?.remove();
    },

    showChatIcon() { },
    removeChatIcon() { }
});
