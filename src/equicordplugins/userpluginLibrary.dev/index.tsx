/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 nin0
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./misc/style.css";

import { showNotification } from "@api/Notifications";
import { migratePluginSettings } from "@api/Settings";
import { Notice } from "@components/Notice";
import plSettings from "@plugins/_core/settings";
import { Devs } from "@utils/constants";
import { relaunch } from "@utils/native";
import definePlugin, { PluginNative } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { Alerts } from "@webpack/common";

import SettingsTab from "./components/SettingsTab";
import UserpluginInstallButton from "./components/UserpluginInstallButton";
import { AppsIcon } from "./misc/constants";
import { settings } from "./settings";
import { VariableWithCallbacks } from "./VariableWithCallbacks";

// @ts-ignore
export const Native = VencordNative.pluginHelpers.UserpluginLibrary as PluginNative<typeof import("./native")>;
export const OpenSettingsModule = findByPropsLazy("openUserSettings");

migratePluginSettings("UserpluginLibrary", "UserpluginInstaller");
export default definePlugin({
    name: "UserpluginLibrary",
    description: "Install userplugins directly from settings/plugin threads",
    settingsAboutComponent: () => (
        <Notice.Warning>
            Equicord does not moderate userplugins and takes no responsibility for anything that may result from installing them.
            Only install userplugins from developers you trust. Doing so is entirely at your own risk.
        </Notice.Warning>
    ),
    async checkPluginUpdates() {
        for (const p of this.plugins.value()) {
            if (await Native.isUpdateAvailableForPlugin(p.directory!)) {
                const t = this.pluginsWithUpdates.value().plugins;
                t.push(p.directory!);
                this.pluginsWithUpdates.value({
                    finished: false,
                    plugins: t
                });
            }
        }
        const t = this.pluginsWithUpdates.value().plugins;
        this.pluginsWithUpdates.value({
            finished: true,
            plugins: t
        });
    },
    section: {
        key: "vencord_userplugins",
        title: "UserPlugins",
        panelTitle: "UserPlugins",
        Component: SettingsTab,
        Icon: AppsIcon
    },
    async start() {
        if (!VencordNative.pluginHelpers.UserpluginLibrary) return void Alerts.show({
            title: "UserpluginLibrary not fully loaded",
            body: "You need to restart to allow the native to be loaded :)",
            confirmText: "Restart now",
            onConfirm() {
                relaunch();
            },
            cancelText: "Later"
        });

        plSettings.customEntries.push(this.section);

        this.pluginsWithUpdates.registerCallback((value, id) => {
            if (value.plugins.length === 0) return;
            if (settings.store.neverNotifyForPlugins.split(",").map(t => t.trim().toLowerCase()).includes(value.plugins[value.plugins.length - 1].toLowerCase()))
                return;
            this.pluginsWithUpdates.deregisterCallback(id);
            if (settings.store.notifyIfUpdate)
                showNotification({
                    title: "Some UserPlugins are out of date!",
                    body: "Click to open the UserPlugin Updater",
                    noPersist: true,
                    permanent: true,
                    onClick() {
                        OpenSettingsModule.openUserSettings("vencord_userplugins_panel");
                    },
                });
        });
        const pls = await Native.getUserplugins();
        // @ts-ignore :trolley:
        this.plugins.value(pls);
        await this.checkPluginUpdates();
    },
    stop() {
        // @ts-ignore
        plSettings.customEntries.splice(plSettings.customEntries.indexOf(this.section), 1);
    },
    plugins: new VariableWithCallbacks<{
        name: string;
        description: string;
        usesPreSend: boolean;
        usesNative: boolean;
        directory: string;
        remote: string;
    }[]>([]),
    pluginsWithUpdates: new VariableWithCallbacks<{
        finished: boolean;
        plugins: string[];
    }>({
        finished: false,
        plugins: []
    }),
    settings,
    authors: [Devs.nin0dev],
    renderMessageAccessory: props => {
        return <UserpluginInstallButton props={props} />;
    }
});
