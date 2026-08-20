/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin from "@utils/types";

export default definePlugin({
    name: "Force Nameplates",
    description: "Forces Discord's nameplates everywhere it can",
    authors: [{ name: "gilbert", id: 1156928708062486568n }],

    patches: [
        {
            find: "PrivateChannel.renderAvatar: Invalid prop configuration",
            replacement: {
                match: /(\i)=null!=(\i)&&\((\i)\|\|(\i)\|\|(\i)\);/,
                replace: "$1=null!=$2&&(true||($3||$4||$5));",
            },
        },
    ],
});
