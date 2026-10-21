/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { Devs, EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";

import { makeDevBanner, settings } from "./components";

export default definePlugin({
    name: "DiscordDevBanner",
    description: "Enables the Discord developer banner, in which displays the build-ID",
    tags: ["Appearance", "Console", "Developers"],
    authors: [EquicordDevs.KrystalSkull, Devs.thororen],
    settings,
    patches: [
        {
            find: '"isHideDevBanner"',
            replacement: [
                {
                    match: '"staging"===window.GLOBAL_ENV.RELEASE_CHANNEL',
                    replace: "true"
                },
                {
                    match: /children:\[.{0,60}(?:#{intl::BUILD_OVERRIDE}|#{intl::uyrfYF::raw}).{0,40}\{\}\)\]/g,
                    replace: "children:$self.makeDevBanner()"
                }
            ]
        }
    ],
    makeDevBanner,
});
