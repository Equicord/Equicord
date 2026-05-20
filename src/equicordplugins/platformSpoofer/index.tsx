/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Notice } from "@components/Notice";
import { EquicordDevs } from "@utils/constants";
import { t } from "@utils/translation";
import definePlugin, { OptionType } from "@utils/types";
import { UserStore } from "@webpack/common";

const settings = definePluginSettings({
    platform: {
        type: OptionType.SELECT,
        description: t("equicord.platformSpoofer.settings.platform"),
        restartNeeded: true,
        options: [
            {
                label: t("equicord.platformSpoofer.settings.platformOptions.desktop"),
                value: "desktop",
                default: true,
            },
            {
                label: t("equicord.platformSpoofer.settings.platformOptions.web"),
                value: "web",
            },
            {
                label: t("equicord.platformSpoofer.settings.platformOptions.android"),
                value: "android"
            },
            {
                label: t("equicord.platformSpoofer.settings.platformOptions.ios"),
                value: "ios"
            },
            {
                label: t("equicord.platformSpoofer.settings.platformOptions.xbox"),
                value: "xbox",
            },
            {
                label: t("equicord.platformSpoofer.settings.platformOptions.playstation"),
                value: "playstation",
            },
            {
                label: "VR",
                value: "vr",
            },
        ]
    }
});

export default definePlugin({
    name: "PlatformSpoofer",
    description: t("equicord.platformSpoofer.description"),
    tags: ["Utility"],
    authors: [EquicordDevs.Drag, EquicordDevs.neoarz],
    settingsAboutComponent: () => (
        <Notice.Warning>
            {t("equicord.platformSpoofer.warning")}
        </Notice.Warning>
    ),
    settings: settings,
    patches: [
        {
            find: "_doIdentify(){",
            replacement: [
                {
                    match: /window._ws=null,null!=\i/,
                    replace: "false"
                },
                {
                    match: /(?<="GatewaySocket"\)\}\),properties:)(\i)/,
                    replace: "{...$1,...$self.getPlatform(true)}"
                },
            ]
        },
        {
            find: '"2025-01-virtual-currency-rollout"',
            replacement: [
                {
                    match: /(?<=\}\),)(\i)/g,
                    replace: "$1=e=>({enabled:true}),_equicord_$1"
                }
            ]
        },
    ],
    getPlatform(bypass, userId?: any) {
        const platform = settings.store.platform ?? "desktop";

        if (bypass || userId === UserStore.getCurrentUser().id) {
            switch (platform) {
                case "desktop":
                    return { browser: "Discord Client" };
                case "web":
                    return { browser: "Discord Web" };
                case "ios":
                    return { browser: "Discord iOS" };
                case "android":
                    return { browser: "Discord Android" };
                case "xbox":
                    return { browser: "Discord Embedded" };
                case "playstation":
                    return { browser: "Discord Embedded" };
                case "vr":
                    return { browser: "Discord VR" };
                default:
                    return null;
            }
        }

        return null;
    }
});
