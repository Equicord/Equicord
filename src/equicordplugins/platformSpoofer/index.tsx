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
        description: t("platformSpoofer.settings.platform"),
        restartNeeded: true,
        options: [
            {
                label: t("platformSpoofer.settings.platformOptions.desktop"),
                value: "desktop",
                default: true,
            },
            {
                label: t("platformSpoofer.settings.platformOptions.web"),
                value: "web",
            },
            {
                label: t("platformSpoofer.settings.platformOptions.android"),
                value: "android"
            },
            {
                label: t("platformSpoofer.settings.platformOptions.ios"),
                value: "ios"
            },
            {
                label: t("platformSpoofer.settings.platformOptions.xbox"),
                value: "xbox",
            },
            {
                label: t("platformSpoofer.settings.platformOptions.playstation"),
                value: "playstation",
            },
        ]
    }
});

export default definePlugin({
    name: "PlatformSpoofer",
    description: t("platformSpoofer.description"),
    authors: [EquicordDevs.Drag],
    settingsAboutComponent: () => (
        <Notice.Warning>
            {t("platformSpoofer.warning")}
        </Notice.Warning>
    ),
    settings: settings,
    patches: [
        {
            find: "_doIdentify(){",
            replacement: {
                match: /(\[IDENTIFY\].*let.{0,5}=\{.*properties:)(.*),presence/,
                replace: "$1{...$2,...$self.getPlatform(true)},presence"
            }
        },
        {
            find: "#{intl::POPOUT_STAY_ON_TOP}),icon:",
            replacement: {
                match: /(?<=CallTile.{0,15}\.memo\((\i)=>\{)/,
                replace: "$1.platform = $self.getPlatform(false, $1?.participantUserId)?.vcIcon || $1?.platform;"
            }
        },
        {
            find: '("AppSkeleton");',
            replacement: {
                match: /(?<=\.isPlatformEmbedded.{0,50}\i\)\)\}.{0,30})\i\?\i\.\i\.set\(.{0,10}:/,
                replace: ""
            }
        }
    ],
    getPlatform(bypass, userId?: any) {
        const platform = settings.store.platform ?? "desktop";

        if (bypass || userId === UserStore.getCurrentUser().id) {
            switch (platform) {
                case "desktop":
                    return { browser: "Discord Client", vcIcon: 0 };
                case "web":
                    return { browser: "Discord Web", vcIcon: 0 };
                case "ios":
                    return { browser: "Discord iOS", vcIcon: 1 };
                case "android":
                    return { browser: "Discord Android", vcIcon: 1 };
                case "xbox":
                    return { browser: "Discord Embedded", vcIcon: 2 };
                case "playstation":
                    return { browser: "Discord Embedded", vcIcon: 3 };
                default:
                    return null;
            }
        }

        return null;
    }
});
