/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings, SettingsStore } from "@api/Settings";
import { EquicordDevs } from "@utils/index";
import { t } from "@utils/translation";
import definePlugin, { OptionType } from "@utils/types";

const MIDDLE_CLICK = 1;
let lastMiddleClickUp = 0;

function updateListeners(refresh: boolean = true) {
    document.removeEventListener("mouseup", handleMouseUp, true);
    document.removeEventListener("auxclick", handleAuxClick, true);

    if (refresh) {
        document.addEventListener("mouseup", handleMouseUp, true);
        document.addEventListener("auxclick", handleAuxClick, true);
    }
}

function handleAuxClick(event: MouseEvent) {
    if (event.button !== MIDDLE_CLICK) return false;

    const { openScope } = settings.store;

    const target = event.target as HTMLElement | null;
    const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
    const media = target?.closest("a[href][data-role='img'], a[href][data-role='video']") as HTMLAnchorElement | null;
    const role = anchor?.dataset.role ?? "";

    const isMedia = !!media;
    const isLink = !isMedia && !!anchor?.href && anchor.getAttribute("href") !== "#" && !["img", "video", "button"].includes(role);

    if (isLink && ["links", "both"].includes(openScope)) {
        event.preventDefault();
        event.stopPropagation();
    } else if (isMedia && ["media", "both"].includes(openScope)) {
        event.preventDefault();
        event.stopPropagation();
    }
}

function handleMouseUp(event: MouseEvent) {
    if (event.button === MIDDLE_CLICK) lastMiddleClickUp = Date.now();
}

const settings = definePluginSettings({
    openScope: {
        type: OptionType.SELECT,
        description: t("middleClickTweaks.settings.openScope"),
        options: [
            { label: t("middleClickTweaks.settings.links"), value: "links" },
            { label: t("middleClickTweaks.settings.media"), value: "media" },
            { label: t("middleClickTweaks.settings.both"), value: "both" },
            { label: t("middleClickTweaks.settings.none"), value: "none", default: true },
        ],
        onChange(newValue) { updateListeners(newValue !== "none"); }
    },
    pasteScope: {
        type: OptionType.SELECT,
        description: t("middleClickTweaks.settings.pasteScope"),
        options: [
            { label: t("middleClickTweaks.settings.always"), value: "always", default: true },
            { label: t("middleClickTweaks.settings.focus"), value: "focus" },
        ]
    },
    pasteThreshold: {
        type: OptionType.NUMBER,
        description: t("middleClickTweaks.settings.pasteThreshold"),
        default: 100,
        onChange(newValue) { if (newValue < 1) { settings.store.pasteThreshold = 1; } }
    }
});

function migrate() {
    const { plugins } = SettingsStore.plain;
    const oldPlugin = plugins?.LimitMiddleClickPaste;

    if (!oldPlugin) return;

    const newPlugin = plugins.MiddleClickTweaks ??= { enabled: false };
    const { scope, threshold, preventLinkOpen } = oldPlugin;

    if (scope) newPlugin.pasteScope = scope;
    if (threshold) newPlugin.pasteThreshold = threshold;
    if (preventLinkOpen) newPlugin.openScope = "both";
    if (oldPlugin.enabled) newPlugin.enabled = true;

    delete plugins.LimitMiddleClickPaste;
    SettingsStore.markAsChanged();
}

migrate();

export default definePlugin({
    name: "MiddleClickTweaks",
    description: t("middleClickTweaks.description"),
    authors: [EquicordDevs.Etorix, EquicordDevs.korzi],
    settings,

    tags: ["LimitMiddleClickPaste"],

    isPastingDisabled(isInput: boolean) {
        const pasteBlocked = Date.now() - lastMiddleClickUp < Math.max(settings.store.pasteThreshold, 1);
        const { pasteScope } = settings.store;

        if (!pasteBlocked) return false;
        if (pasteScope === "always") return true;
        if (pasteScope === "focus" && !isInput) return true;

        return false;
    },

    start() {
        migrate();
        updateListeners();
    },

    stop() { updateListeners(false); },

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
