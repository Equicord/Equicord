/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
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

import { ClockIcon } from "@equicordplugins/themeLibrary/utils/Icons";
import SettingsPlugin, { settingsSectionMap } from "@plugins/_core/settings";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

import StartupTimingPage from "./StartupTimingPage";

export default definePlugin({
    name: "StartupTimings",
    description: "Adds Startup Timings to the Settings menu",
    authors: [Devs.Megu],
    start() {
        const { customEntries, customSections } = SettingsPlugin;

        customEntries.push({
            key: "equicord_startup_timings",
            title: "Startup Timings",
            Component: StartupTimingPage,
            Icon: ClockIcon
        });

        customSections.push(() => ({
            section: "EquicordStartupTimings",
            label: "Startup Timings",
            searchableTitles: ["Startup Timings"],
            element: StartupTimingPage,
            id: "EquicordStartupTimings",
        }));

        settingsSectionMap.push(["EquicordStartupTimings", "equicord_startup_timings"]);
    },
    stop() {
        const { customEntries, customSections } = SettingsPlugin;
        const entryIdx = customEntries.findIndex(e => e.key === "equicord_startup_timings");
        if (entryIdx !== -1) customEntries.splice(entryIdx, 1);
        const section = customSections.findIndex(section => section({} as any).id === "EquicordStartupTimings");
        if (section !== -1) customSections.splice(section, 1);
        const map = settingsSectionMap.findIndex(entry => entry[1] === "equicord_startup_timings");
        if (map !== -1) customEntries.splice(map, 1);
    },
});
