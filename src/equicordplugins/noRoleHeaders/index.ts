/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import { t } from "@utils/translation";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "NoRoleHeaders",
    description: t("noRoleHeaders.description"),
    authors: [Devs.Samwich],
    patches: [
        {
            find: "._areActivitiesExperimentallyHidden=(",
            replacement: {
                match: /return \i===\i\.\i\.UNKNOWN/,
                replace: "return null;$&"
            }
        }
    ]
});
