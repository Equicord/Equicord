/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType, ReporterTestable } from "@utils/types";
import { t } from "@utils/translation";

import { initWs, socket, stopWs } from "./initWs";
export const PORT = 8485;
export const CLIENT_VERSION: readonly [major: number, minor: number, patch: number] = [0, 1, 2];

export const logger = new Logger("DevCompanion");

export const settings = definePluginSettings({
    notifyOnAutoConnect: {
        description: t("devCompanion.settings.notifyOnAutoConnect"),
        type: OptionType.BOOLEAN,
        default: true
    },
    usePatchedModule: {
        description: t("devCompanion.settings.usePatchedModule"),
        default: true,
        type: OptionType.BOOLEAN,
    },
    reloadAfterToggle: {
        description: t("devCompanion.settings.reloadAfterToggle"),
        default: true,
        type: OptionType.BOOLEAN
    }
});

export default definePlugin({
    name: "DevCompanion",
    description: t("devCompanion.description"),
    authors: [Devs.Ven, Devs.sadan],
    reporterTestable: ReporterTestable.None,
    isModified: true,
    settings,

    toolboxActions: {
        Reconnect() {
            socket?.close(1000, "Reconnecting");
            initWs(true);
        }
    },

    start() {
        // if we're running the reporter, we need to initws in the reporter file to avoid a race condition
        if (!IS_DEV) throw new Error("This plugin requires dev mode to run, please build with pnpm build --dev");
        initWs();
        window.reconnectDevtools = () => {
            socket?.close(1000, "Reconnecting");
            initWs(true);
        };
    },

    stop: stopWs,
});
