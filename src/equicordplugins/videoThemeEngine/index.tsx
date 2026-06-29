/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EquicordDevs } from "@utils/constants";
import definePlugin, { StartAt } from "@utils/types";
import { createRoot, React } from "@webpack/common";
import type { Root } from "react-dom/client";

import { VideoLayer } from "./components/VideoLayer";
import { migrateLegacySettings, settings } from "./settings";
import managedStyle from "./styles.css?managed";
import { applyUiStyles, removeUiStyles, startSettingsListener, stopSettingsListener } from "./utils/styleManager";
import { revokeActiveObjectUrl } from "./utils/video";

let videoRoot: Root | null = null;
let container: HTMLDivElement | null = null;

export default definePlugin({
    name: "VideoThemeEngine",
    description: "Set a local MP4 as a fullscreen background behind a transparent Discord UI, with live presets and panel controls.",
    authors: [EquicordDevs.remyvn],
    tags: ["Appearance", "Customisation", "Media"],
    managedStyle,
    settings,
    startAt: StartAt.DOMContentLoaded,

    start() {
        migrateLegacySettings();
        startSettingsListener();

        container = document.createElement("div");
        container.id = "vc-videothemeengine-root";
        document.body.insertBefore(container, document.body.firstChild);

        videoRoot = createRoot(container);
        videoRoot.render(<VideoLayer />);

        applyUiStyles();
    },

    stop() {
        stopSettingsListener();

        if (videoRoot) {
            videoRoot.unmount();
            videoRoot = null;
        }
        if (container) {
            container.remove();
            container = null;
        }

        removeUiStyles();
        revokeActiveObjectUrl();
    },
});
