/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "FixCodeblockGap",
    nameI18n: "equicord.plugins.fixCodeblockGap.name",
    description: "Removes the gap between codeblocks and text below it",
    descriptionI18n: "equicord.plugins.fixCodeblockGap.description",
    tags: ["Appearance"],
    authors: [Devs.Grzesiek11],
    patches: [
        {
            find: String.raw`/^${"```"}(?:([a-z0-9_+\-.#]+?)\n)?\n*([^\n][^]*?)\n*${"```"}`,
            replacement: {
                match: String.raw`/^${"```"}(?:([a-z0-9_+\-.#]+?)\n)?\n*([^\n][^]*?)\n*${"```"}`,
                replace: "$&\\n?",
            },
        },
    ],
});
