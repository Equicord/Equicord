/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "SelfForward",
    nameI18n: "equicord.plugins.selfForward.name",
    description: "Adds the current channel to the forward list popup",
    descriptionI18n: "equicord.plugins.selfForward.description",
    tags: ["Utility"],
    authors: [EquicordDevs.VillainsRule],
    patches: [
        {
            find: ".getChannelHistory(),",
            replacement: [{
                match: /\i.id\]/,
                replace: "]"
            }]
        }
    ]
});
