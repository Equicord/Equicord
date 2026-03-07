/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import { t } from "@utils/translation";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "NoTypingAnimation",
    authors: [Devs.AutumnVN],
    description: t("vencord.noTypingAnimation.description"),
    patches: [
        {
            find: "dotCycle",
            replacement: {
                match: /focused:(\i)/g,
                replace: (_, focused) => `_focused:${focused}=false`
            }
        }
    ]
});
