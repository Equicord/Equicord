/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import { t } from "@utils/translation";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "HeaderBarAPI",
    description: t("equicord.headerBarAPI.description"),
    authors: [Devs.prism],

    patches: [
        {
            find: '?"BACK_FORWARD_NAVIGATION":',
            replacement: {
                match: /(?<="HELP"===.{0,150}className:\i\.\i\}\))(?=\])/,
                replace: ",...Vencord.Api.HeaderBar._addHeaderBarButtons()"
            }
        },
        {
            find: "Missing channel in Channel.renderHeaderToolbar",
            replacement: {
                match: /(?<=renderHeaderToolbar"\);let (\i)=\[\];)/,
                replace: "Vencord.Api.HeaderBar._addChannelToolbarButtons($1);"
            }
        }
    ]
});
