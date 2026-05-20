/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors*
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "DisableCameras",
    nameI18n: "equicord.plugins.disableCameras.name",
    description: "Disables cameras in a call by default",
    descriptionI18n: "equicord.plugins.disableCameras.description",
    tags: ["Appearance", "Customisation", "Media", "Privacy"],
    authors: [Devs.Joona],
    patches: [
        {
            find: ".identifyStartTime))",
            replacement: {
                match: /\i\.self_video\|\|!1/g,
                replace: "false"
            },
        }
    ]
});
