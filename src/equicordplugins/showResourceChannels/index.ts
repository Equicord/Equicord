/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EquicordDevs } from "@utils/constants";
import { t } from "@utils/translation";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "ShowResourceChannels",
    description: t("showResourceChannels.description"),
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
