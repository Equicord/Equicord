/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { MagnifyingGlassIcon } from "@components/Icons";
import SettingsPlugin from "@plugins/_core/settings";
import { EquicordDevs } from "@utils/constants";
import { removeFromArray } from "@utils/misc";
import { t } from "@utils/translation";
import definePlugin, { StartAt } from "@utils/types";
import { SettingsRouter } from "@webpack/common";

import IconsTab from "./components/IconsTab";
import { SettingsAbout } from "./components/Modals";

export default definePlugin({
    name: "IconViewer",
    description: t("iconViewer.description"),
    authors: [EquicordDevs.iamme],
    dependencies: ["Settings"],
    startAt: StartAt.WebpackReady,
    toolboxActions: {
        [t("iconViewer.ui.openIconsTab")]() {
            SettingsRouter.openUserSettings("equicord_icon_viewer_panel");
        },
    },
    settingsAboutComponent: SettingsAbout,
    start() {
        SettingsPlugin.customEntries.push({
            key: "equicord_icon_viewer",
            title: t("iconViewer.ui.iconFinder"),
            Component: IconsTab,
            Icon: MagnifyingGlassIcon
        });

        SettingsPlugin.settingsSectionMap.push(["EquicordDiscordIcons", "equicord_icon_viewer"]);
    },
    stop() {
        removeFromArray(SettingsPlugin.customEntries, e => e.key === "equicord_icon_viewer");
        removeFromArray(SettingsPlugin.settingsSectionMap, entry => entry[1] === "equicord_icon_viewer");
    },
});
