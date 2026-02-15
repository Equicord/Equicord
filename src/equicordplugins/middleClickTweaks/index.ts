/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Styles } from "@api/index";
import { definePluginSettings, SettingsStore } from "@api/Settings";
import { createAndAppendStyle, EquicordDevs } from "@utils/index";
import definePlugin, { OptionType } from "@utils/types";

const LEFT_CLICK = 0;
const MIDDLE_CLICK = 1;
const MEDIA_STYLE_ID = "middleclicktweaks-media-block";
const MEDIA_STYLE_CONTENT = `
    img,
    a[data-role="img"],
    video {
        pointer-events: none !important;
    }
`;

let mediaStyle: HTMLStyleElement | null = null;
let lastMiddleClickUp = 0;

function updateMediaStyle(scope: string) {
    const shouldEnable = scope === "media" || scope === "both";

    if (shouldEnable) {
        if (!mediaStyle) {
            mediaStyle = createAndAppendStyle(MEDIA_STYLE_ID, Styles.managedStyleRootNode);
            mediaStyle.textContent = MEDIA_STYLE_CONTENT;
        }
    } else {
        mediaStyle?.remove();
        mediaStyle = null;
    }
}

function updateListeners(openScope: string) {
    document.removeEventListener("auxclick", handleAuxClick, true);
    document.removeEventListener("click", handleMediaClick, true);
    if (["links", "both"].includes(openScope)) { document.addEventListener("auxclick", handleAuxClick, true); }
    if (["media", "both"].includes(openScope)) { document.addEventListener("click", handleMediaClick, true); }
}

const settings = definePluginSettings({
    openScope: {
        type: OptionType.SELECT,
        description: "Prevent middle clicking on these content types from opening them.",
        options: [
            { label: "Links", value: "links" },
            { label: "Media", value: "media" },
            { label: "Links & Media", value: "both" },
            { label: "None", value: "none", default: true },
        ],
        onChange(newValue) {
            updateMediaStyle(newValue);
            updateListeners(newValue);
        }
    },
    pasteScope: {
        type: OptionType.SELECT,
        description: "Prevent middle click from pasting during these situations.",
        options: [
            { label: "Always Prevent Middle Click Pasting", value: "always", default: true },
            { label: "Only Prevent When Text Area Not Focused", value: "focus" },
        ]
    },
    pasteThreshold: {
        type: OptionType.NUMBER,
        description: "Milliseconds until pasting is enabled again after a middle click.",
        default: 100,
        onChange(newValue) { if (newValue < 1) { settings.store.pasteThreshold = 1; } },
    }
});

function shouldBlockLink(event: MouseEvent): boolean {
    if (event.button !== MIDDLE_CLICK) return false;

    const target = event.target as HTMLElement | null;
    const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
    const role = anchor?.dataset.role ?? "";

    if (!anchor) return false;
    if (["img", "video", "button"].includes(role)) return false;

    return !!anchor.href && anchor.href !== "#";
}

function handleAuxClick(event: MouseEvent) {
    if (!shouldBlockLink(event)) return;
    event.preventDefault();
    event.stopPropagation();
}

function handleMediaClick(event: MouseEvent) {
    if (event.button !== LEFT_CLICK) return;
    if (!["media", "both"].includes(settings.store.openScope)) return;

    const target = event.target as HTMLElement;
    const videoControls = target.querySelector?.("[class^='videoControls']") as HTMLElement | null;
    const video = videoControls?.querySelector?.("[class^='videoButton']") as HTMLVideoElement | null;

    if (video) {
        event.preventDefault();
        event.stopPropagation();
        video.click();
    }
}

function migrate() {
    const { plugins } = SettingsStore.plain;
    const oldPlugin = plugins.LimitMiddleClickPaste;
    const newPlugin = plugins.MiddleClickTweaks;
    const { scope, threshold, preventLinkOpen } = oldPlugin || {};

    if (!oldPlugin || !newPlugin) return;
    if (scope) newPlugin.pasteScope = scope === "always" ? "always" : "focus";
    if (threshold) newPlugin.pasteThreshold = threshold;
    if (preventLinkOpen) newPlugin.openScope = !!preventLinkOpen ? "both" : "none";
    if (oldPlugin.enabled) newPlugin.enabled = true;

    delete plugins.LimitMiddleClickPaste;
    SettingsStore.markAsChanged();
}

migrate();

export default definePlugin({
    name: "MiddleClickTweaks",
    description: "Various middle click tweaks, such as with pasting and link opening.",
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

    onMouseUp: (event: MouseEvent) => {
        if (event.button === MIDDLE_CLICK) lastMiddleClickUp = Date.now();
    },

    start() {
        migrate();
        document.addEventListener("mouseup", this.onMouseUp);
        const { openScope } = settings.store;
        updateMediaStyle(openScope);
        updateListeners(openScope);
    },

    stop() {
        document.removeEventListener("mouseup", this.onMouseUp);
        updateListeners("none");
        updateMediaStyle("none");
    },

    patches: [
        {
            find: "document.addEventListener(\"paste\",",
            replacement: {
                match: /(?<=paste",(\i)=>{)/,
                replace: "if($1.target.tagName===\"BUTTON\"||$self.isPastingDisabled(false)){$1.preventDefault?.();$1.stopPropagation?.();return;};"
            }
        },
        {
            find: ",origin:\"clipboard\"});",
            replacement: {
                match: /(?<=handlePaste=(\i)=>{)(?=let)/,
                replace: "if($self.isPastingDisabled(true)){$1.preventDefault?.();$1.stopPropagation?.();return;}"
            }
        },
        {
            find: "props.handlePastedText&&",
            replacement: {
                match: /(?<=clipboardData\);)/,
                replace: "if($self.isPastingDisabled(true)){arguments[1].preventDefault?.();arguments[1].stopPropagation?.();return;};"
            }
        },
    ],
});
