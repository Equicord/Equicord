/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "NoTypingAnimation",
    nameI18n: "equicord.plugins.noTypingAnimation.name",
    authors: [Devs.AutumnVN],
    description: "Disables the CPU-intensive typing dots animation",
    descriptionI18n: "equicord.plugins.noTypingAnimation.description",
    tags: ["Appearance"],
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
