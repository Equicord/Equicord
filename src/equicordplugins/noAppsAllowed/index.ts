/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EquicordDevs } from "@utils/constants";
import { t } from "@utils/translation";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "NoAppsAllowed",
    description: t("noAppsAllowed.description"),
    authors: [EquicordDevs.meowabyte],
    patches: [
        {
            find: '"#{intl::APP_TAG::hash}":',
            replacement: {
                match: /(#{intl::APP_TAG::hash}":\[").*?("\])/,
                replace: "$1BOT$2"
            }
        }
    ]
});
