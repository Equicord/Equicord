/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "ShowResourceChannels",
    nameI18n: "equicord.plugins.showResourceChannels.name",
    description: "shows the channels hidden behind the server resources in the channel list",
    descriptionI18n: "equicord.plugins.showResourceChannels.description",
    tags: ["Servers"],
    authors: [EquicordDevs.VillainsRule],
    patches: [
        {
            find: ".GUILD_DIRECTORY:null",
            replacement: [
                {
                    match: /\i\.hideResourceChannels&&/,
                    replace: "false&&"
                }
            ]
        }
    ]
});
