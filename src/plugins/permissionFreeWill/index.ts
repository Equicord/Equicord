/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import { canonicalizeMatch } from "@utils/patches";
import { t } from "@utils/translation";
import definePlugin, { OptionType } from "@utils/types";

const settings = definePluginSettings({
    lockout: {
        type: OptionType.BOOLEAN,
        default: true,
        description: t("vencord.permissionFreeWill.settings.lockout"),
        restartNeeded: true
    },
    onboarding: {
        type: OptionType.BOOLEAN,
        default: true,
        description: t("vencord.permissionFreeWill.settings.onboarding"),
        restartNeeded: true
    }
});

export default definePlugin({
    name: "PermissionFreeWill",
    description: t("vencord.permissionFreeWill.description"),
    authors: [Devs.lewisakura],

    patches: [
        // Permission lockout, just set the check to true
        {
            find: "#{intl::STAGE_CHANNEL_CANNOT_OVERWRITE_PERMISSION}",
            replacement: [
                {
                    match: /case"DENY":.{0,50}if\((?=\i\.\i\.can)/,
                    replace: "$&true||"
                }
            ],
            predicate: () => settings.store.lockout
        },
        // Onboarding, same thing but we need to prevent the check
        {
            find: "#{intl::ONBOARDING_CHANNEL_THRESHOLD_WARNING}",
            replacement: [
                {
                    // replace export getters with functions that always resolve to true
                    match: /{(?:\i:\(\)=>\i,?){2}}/,
                    replace: m => m.replaceAll(canonicalizeMatch(/\(\)=>\i/g), "()=>()=>Promise.resolve(true)")
                }
            ],
            predicate: () => settings.store.onboarding
        }
    ],
    settings
});
