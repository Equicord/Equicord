/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EquicordDevs } from "@utils/constants";
import { t } from "@utils/translation";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "NoPushToTalk",
    description: t("equicord.noPushToTalk.description"),
    authors: [EquicordDevs.omaw],
    patches: [
        {
            find: "PermissionVADStore",
            replacement: [
                {
                    match: /\|\|\i\.\i\.can\(\i\.\i\.USE_VAD,\i\)\|\|/,
                    replace: "||true||"
                },
                {
                    match: /shouldShowWarning\(\)\{return!\i\}/,
                    replace: "shouldShowWarning(){return false}"
                },
                {
                    match: /canUseVoiceActivity\(\)\{return \i\}/,
                    replace: "canUseVoiceActivity(){return true}"
                },
            ]
        }
    ],
});
