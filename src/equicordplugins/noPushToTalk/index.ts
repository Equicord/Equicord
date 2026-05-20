/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "NoPushToTalk",
    nameI18n: "equicord.plugins.noPushToTalk.name",
    description: "Bypasses the push-to-talk requirement for voice activity in channels that enforce it.",
    descriptionI18n: "equicord.plugins.noPushToTalk.description",
    tags: ["Servers", "Voice"],
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
