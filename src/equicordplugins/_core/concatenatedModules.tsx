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

    required: true,

    patches: [
        {
            find: "AngleBracketsIcon",
            replacement: {
                match: /\i\.\i\((\i)\),\i\.\i\(\i,\{AIcon/,
                replace: "$self.iconsModule($1),$&"
            }
        }
    ],
    iconsModule(value: IconsDef) {
        iconsModule = value;
    },
});
