/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import { t } from "@utils/translation";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "NoModalAnimation",
    description: t("noModalAnimation.description"),
    authors: [Devs.AutumnVN],
    patches: [
        {
            find: "DURATION_IN:",
            replacement: {
                match: /300,/,
                replace: "0,",
            }
        },
        {
            find: 'backdropFilter:"blur(0px)"',
            replacement: {
                match: /\?0:200/,
                replace: "?0:0",
            }
        },
        {
            find: '="ABOVE"',
            replacement: {
                match: /\?\?300/,
                replace: "??0",
            }
        },
        {
            find: "renderLurkerModeUpsellPopout,position:",
            replacement: {
                match: /200:300/g,
                replace: "0:0",
            },
        }
    ]
});
