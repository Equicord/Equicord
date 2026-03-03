/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import { t } from "@utils/translation";
import definePlugin, { OptionType } from "@utils/types";

const settings = definePluginSettings({
    defaultLayout: {
        type: OptionType.SELECT,
        options: [
            { label: t("vencord.overrideForumDefaults.layouts.list"), value: 1, default: true },
            { label: t("vencord.overrideForumDefaults.layouts.gallery"), value: 2 }
        ],
        description: t("vencord.overrideForumDefaults.settings.defaultLayout")
    },
    defaultSortOrder: {
        type: OptionType.SELECT,
        options: [
            { label: t("vencord.overrideForumDefaults.sortOrders.recentlyActive"), value: 0, default: true },
            { label: t("vencord.overrideForumDefaults.sortOrders.datePosted"), value: 1 }
        ],
        description: t("vencord.overrideForumDefaults.settings.defaultSortOrder")
    }
});

export default definePlugin({
    name: "OverrideForumDefaults",
    description: t("vencord.overrideForumDefaults.description"),
    authors: [Devs.Inbestigator],
    patches: [
        {
            find: "getDefaultLayout(){",
            replacement: [
                {
                    match: /}getDefaultLayout\(\){/,
                    replace: "$&return $self.getLayout();"
                },
                {
                    match: /}getDefaultSortOrder\(\){/,
                    replace: "$&return $self.getSortOrder();"
                }
            ]
        }
    ],

    getLayout: () => settings.store.defaultLayout,
    getSortOrder: () => settings.store.defaultSortOrder,

    settings
});
