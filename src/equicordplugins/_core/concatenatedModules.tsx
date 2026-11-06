/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IconsDef } from "@equicordplugins/iconViewer/types";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

export let iconsModule: IconsDef;

export default definePlugin({
    name: "ConcatenatedModules",
    description: "Extract modules that have been concatenated by the bundler",
    authors: [Devs.thororen],
    patches: [
        {
            find: ".web.tsx`",
            replacement: {
                match: /function \i\(\i\)\{let \i,\{badgeIcon:(?=.{0,400}\?\?=(\i\(\d+\));let \i=`\.\/\$\{\i\}\.web\.tsx`)/,
                replace: "$self.loadIcons($1);$&"
            }
        }
    ],
    async loadIcons(load: ((path: string) => Promise<IconsDef>) & { keys(): string[]; }) {
        const icons = await Promise.all(load.keys().map(load));
        this.setIconsModule(Object.assign({}, ...icons));
    },
    setIconsModule(value: IconsDef) {
        iconsModule = value;

        // incase you dont want to use iconviewer you can do
        // Vencord.Plugins.plugins.ConcatenatedModules.iconsModule instead for icons and viewing paths
        this.iconsModule = value;
    },
});
