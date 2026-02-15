/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { t } from "@utils/translation";
import { OptionType } from "@utils/types";
import { React } from "@webpack/common";

export const settings = definePluginSettings({
    memberList: {
        type: OptionType.BOOLEAN,
        description: t("betterActivities.settings.memberList"),
        default: true,
        restartNeeded: true,
    },
    iconSize: {
        type: OptionType.SLIDER,
        description: t("betterActivities.settings.iconSize"),
        markers: [10, 15, 20],
        default: 15,
        stickToMarkers: false,
    },
    specialFirst: {
        type: OptionType.BOOLEAN,
        description: t("betterActivities.settings.specialFirst"),
        default: true,
        restartNeeded: false,
    },
    renderGifs: {
        type: OptionType.BOOLEAN,
        description: t("betterActivities.settings.renderGifs"),
        default: true,
        restartNeeded: false,
    },
    removeGameActivityStatus: {
        type: OptionType.BOOLEAN,
        description: t("betterActivities.settings.removeGameActivityStatus"),
        default: false,
        restartNeeded: true,
    },
    divider: {
        type: OptionType.COMPONENT,
        description: "",
        component: () => (
            <div style={{
                width: "100%",
                height: 1,
                borderTop: "thin solid var(--input-border-default, var(--input-border))",
                paddingTop: 5,
                paddingBottom: 5
            }} />
        ),
    },
    userPopout: {
        type: OptionType.BOOLEAN,
        description: t("betterActivities.settings.userPopout"),
        default: true,
        restartNeeded: true,
    },
    hideTooltip: {
        type: OptionType.BOOLEAN,
        description: t("betterActivities.settings.hideTooltip"),
        default: true,
    },
    allActivitiesStyle: {
        type: OptionType.SELECT,
        description: t("betterActivities.settings.allActivitiesStyle"),
        options: [
            {
                default: true,
                label: t("betterActivities.options.carousel"),
                value: "carousel",
            },
            {
                label: t("betterActivities.options.list"),
                value: "list",
            },
        ]
    }
});
