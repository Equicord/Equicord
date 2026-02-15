/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/index";
import { t } from "@utils/translation";
import definePlugin, { OptionType } from "@utils/types";

const MIDDLE_CLICK = 1;

let lastMiddleClickUp = 0;

const settings = definePluginSettings({
    scope: {
        type: OptionType.SELECT,
        description: t("limitMiddleClickPaste.settings.scope"),
        options: [
            {
                label: t("limitMiddleClickPaste.options.alwaysPrevent"),
                value: "always",
                default: true
            },
            {
                label: t("limitMiddleClickPaste.options.onlyWhenNotFocused"),
                value: "focus"
            },
        ]
    },
    threshold: {
        type: OptionType.NUMBER,
        description: t("limitMiddleClickPaste.settings.threshold"),
        default: 100,
        onChange(newValue) { if (newValue < 1) { settings.store.threshold = 1; } },
    },
    preventLinkOpen: {
        type: OptionType.BOOLEAN,
        description: t("limitMiddleClickPaste.settings.preventLinkOpen"),
        default: false,
        onChange(newValue) {
            if (newValue) {
                document.addEventListener("auxclick", handleAuxClick, true);
            } else {
                document.removeEventListener("auxclick", handleAuxClick, true);
            }
        },
    },
});

function shouldBlockLink(e: MouseEvent): boolean {
    if (e.button !== MIDDLE_CLICK) return false;

    const target = e.target as HTMLElement | null;
    if (!target?.closest) return false;

    const a = target.closest("a[href]") as HTMLAnchorElement | null;
    if (!a) return false;

    const href = a.getAttribute("href");
    return !!href && href !== "#";
}

function handleAuxClick(e: MouseEvent) {
    if (!shouldBlockLink(e)) return;
    e.preventDefault();
    e.stopPropagation();
}

export default definePlugin({
    name: "LimitMiddleClickPaste",
    description: t("limitMiddleClickPaste.description"),
    authors: [EquicordDevs.Etorix, EquicordDevs.korzi],
    settings,

    isPastingDisabled(isInput: boolean) {
        const pasteBlocked = Date.now() - lastMiddleClickUp < Math.max(settings.store.threshold, 1);
        const { scope } = settings.store;

        if (!pasteBlocked) return false;
        if (scope === "always") return true;
        if (scope === "focus" && !isInput) return true;

        return false;
    },

    onMouseUp: (e: MouseEvent) => {
        if (e.button === MIDDLE_CLICK) lastMiddleClickUp = Date.now();
    },

    start() {
        document.addEventListener("mouseup", this.onMouseUp);
        if (settings.store.preventLinkOpen) {
            document.addEventListener("auxclick", handleAuxClick, true);
        }
    },

    stop() {
        document.removeEventListener("mouseup", this.onMouseUp);
        document.removeEventListener("auxclick", handleAuxClick, true);
    },

    patches: [
        {
            // Detects paste events triggered by the "browser" outside of input fields.
            find: "document.addEventListener(\"paste\",",
            replacement: {
                match: /(?<=paste",(\i)=>{)/,
                replace: "if($1.target.tagName===\"BUTTON\"||$self.isPastingDisabled(false)){$1.preventDefault?.();$1.stopPropagation?.();return;};"
            }
        },
        {
            // Detects paste events triggered inside of Discord's text input.
            find: ",origin:\"clipboard\"});",
            replacement: {
                match: /(?<=handlePaste=(\i)=>{)(?=let)/,
                replace: "if($self.isPastingDisabled(true)){$1.preventDefault?.();$1.stopPropagation?.();return;}"
            }
        },
        {
            // Detects paste events triggered inside of Discord's search box.
            find: "props.handlePastedText&&",
            replacement: {
                match: /(?<=clipboardData\);)/,
                replace: "if($self.isPastingDisabled(true)){arguments[1].preventDefault?.();arguments[1].stopPropagation?.();return;};"
            }
        },
    ],
});
