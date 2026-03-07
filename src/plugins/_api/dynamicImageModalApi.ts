/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import { t } from "@utils/translation";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "DynamicImageModalAPI",
    authors: [Devs.sadan, Devs.Nuckyz],
    description: t("vencord.dynamicImageModalAPI.description"),
    patches: [
        {
            // TODO: bundler compat
            find: ".renderLinkComponent",
            replacement: {
                // widthAndHeightPassed = w != null && w !== 0 && h == null || h === 0
                match: /(?<=\i=)(null!=\i&&0!==\i)&&(null!=\i&&0!==\i)/,
                replace: "($1)||($2)"
            }
        }
    ]
});
