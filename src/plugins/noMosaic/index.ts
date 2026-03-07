/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import { t } from "@utils/translation";
import definePlugin, { OptionType } from "@utils/types";

const settings = definePluginSettings({
    inlineVideo: {
        description: t("vencord.noMosaic.description.settings.inlineVideo"),
        type: OptionType.BOOLEAN,
        default: true,
        restartNeeded: true
    }
});

export default definePlugin({
    name: "NoMosaic",
    authors: [Devs.AutumnVN],
    description: t("vencord.noMosaic.description"),
    tags: ["image", "mosaic", "media"],

    settings,

    patches: [
        {
            find: '"PLAINTEXT_PREVIEW":"OTHER"',
            replacement: {
                match: /=>"IMAGE"===\i\|\|"VIDEO"===\i(?:\|\|("VISUAL_PLACEHOLDER"===\i))?;/,
                replace: (_, visualPlaceholderPred) => visualPlaceholderPred != null ? `=>${visualPlaceholderPred};` : "=>false;"
            }
        },
        {
            find: "renderAttachments(",
            predicate: () => settings.store.inlineVideo,
            replacement: {
                match: /url:(\i)\.url\}\);return /,
                replace: "$&$1.content_type?.startsWith('image/')&&"
            }
        },
    ]
});
