/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "ChatInputButtonAPI",
    description: "API to add buttons to the chat input",
    authors: [Devs.Ven],

    patches: [
        {
            find: '"sticker")',
            replacement: [
                {
                    match: /(?=\i&&(\i)\.push.{0,15}"submit")/,
                    replace: "Vencord.Api.ChatButtons._injectButtons($1,arguments[0]),"
                },
                {
                    match: /(?<=\(\i\).filter\((\i)=>)(null!=.{0,5}key\])(\).sortBy\((\i)=>)(.{0,5}\.key\])/,
                    replace: "$1.isCustom||$2$3[$4.isCustom?0:1,$5]"
                }
            ]
        }
    ]
});
