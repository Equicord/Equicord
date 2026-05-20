/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "NoRoleHeaders",
    nameI18n: "equicord.plugins.noRoleHeaders.name",
    description: "We are all equal!! Removes the role headers in the member list.",
    descriptionI18n: "equicord.plugins.noRoleHeaders.description",
    tags: ["Appearance", "Fun", "Roles"],
    authors: [Devs.Samwich],
    patches: [
        {
            find: "this.updateMaxContentFeedRowSeen()",
            replacement: {
                match: /return \i===\i\.\i\.UNKNOWN/,
                replace: "return null;$&"
            }
        }
    ]
});
