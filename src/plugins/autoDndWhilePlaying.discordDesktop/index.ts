/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings, migratePluginSettings } from "@api/Settings";
import { getUserSettingLazy } from "@api/UserSettings";
import { Devs } from "@utils/constants";
import { t } from "@utils/translation";
import definePlugin, { OptionType } from "@utils/types";

let savedStatus: string | null;

const StatusSettings = getUserSettingLazy<string>("status", "status")!;

const settings = definePluginSettings({
    statusToSet: {
        type: OptionType.SELECT,
        description: t("autoDndWhilePlaying.settings.statusToSet"),
        options: [
            {
                label: t("autoDndWhilePlaying.statusOptions.online"),
                value: "online",
            },
            {
                label: t("autoDndWhilePlaying.statusOptions.idle"),
                value: "idle",
            },
            {
                label: t("autoDndWhilePlaying.statusOptions.dnd"),
                value: "dnd",
                default: true
            },
            {
                label: t("autoDndWhilePlaying.statusOptions.invisible"),
                value: "invisible",
            }
        ]
    },
    excludeInvisible: {
        type: OptionType.BOOLEAN,
        description: t("autoDndWhilePlaying.settings.excludeInvisible"),
        default: false
    },
});

migratePluginSettings("AutoDNDWhilePlaying", "StatusWhilePlaying");
export default definePlugin({
    name: "AutoDNDWhilePlaying",
    description: t("autoDndWhilePlaying.description"),
    authors: [Devs.thororen],
    isModified: true,
    settings,
    flux: {
        RUNNING_GAMES_CHANGE({ games }) {
            const status = StatusSettings.getSetting();

            if (settings.store.excludeInvisible && (savedStatus ?? status) === "invisible") return;

            if (games.length > 0) {
                if (status !== settings.store.statusToSet) {
                    savedStatus = status;
                    StatusSettings.updateSetting(settings.store.statusToSet);
                }
            } else if (savedStatus && savedStatus !== settings.store.statusToSet) {
                StatusSettings.updateSetting(savedStatus);
            }
        }
    }
});
