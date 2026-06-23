/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 nin0
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./misc/style.css";

import { showNotification } from "@api/Notifications";
import { definePluginSettings } from "@api/Settings";
import { BaseText } from "@components/BaseText";
import { Button } from "@components/Button";
import { Flex } from "@components/Flex";
import { Notice } from "@components/Notice";
import plSettings from "@plugins/_core/settings";
import { Devs } from "@utils/constants";
import { relaunch } from "@utils/native";
import definePlugin, { OptionType, PluginNative } from "@utils/types";
import { findByPropsLazy, findComponentByCodeLazy } from "@webpack";
import { Alerts, showToast, Toasts, useEffect, useState } from "@webpack/common";

import LibraryTab from "./components/LibraryTab";
import SettingsTab from "./components/SettingsTab";
import UserpluginInstallButton from "./components/UserpluginInstallButton";
import { authorize } from "./oauth";
import { TypeOfVWC, VariableWithCallbacks } from "./VariableWithCallbacks";

// @ts-ignore
export const Native = VencordNative.pluginHelpers.UserpluginLibrary as PluginNative<typeof import("./native")>;
export const OpenSettingsModule = findByPropsLazy("openUserSettings");
const AppsIcon = findComponentByCodeLazy("2.95H20a2 2 0");
const ShopSparkleIcon = findComponentByCodeLazy("M20.14.8a1.21 1.21 0 0 0-2.28 0l-.5 1.37a2 2 0 0 1-1.19 1.18l-1.38.51a1.21 1.21 0 0 0 0 2.28l1.38.5a2 2 0 0 1 1.18 1.19l.51 1.38a1.2 1.2 0 0 0 1.15.79l.17-.01c.4-.06.79-.32.96-.78l.5-1.38a2 2 0 0 1 1.19-1.18l1.38-.51a1.21 1.21 0 0 0 0-2.28l-1.38-.5a2 2 0 0 1-1.18-1.19L20.14.79ZM20.98 11.84c0-.2-.24-.33-.42-.22-1.79 1.01-3.6-.17-4.87-1.55a.28.28 0 0 0-.4 0 4.49 4.49 0 0 1-6.58 0 .28.28 0 0 0-.4 0 4.45 4.45 0 0 1-4.94 1.11c-.17-.07-.37.06-.37.24V19a3 3 0 0 0 3 3h2.75c.14 0 .25-.11.25-.25V16c0-1.1.9-2 2-2h2a2 2 0 0 1 2 2v5.75c0 .14.11.25.25.25H18a3 3 0 0 0 3-3l-.02-7.16Z");
const auth = new VariableWithCallbacks<{
    token?: string;
    username?: string;
}>({
    token: undefined,
    username: undefined
});

export const settings = definePluginSettings({
    h: {
        type: OptionType.COMPONENT,
        component: () => <BaseText style={{ fontSize: "1.2rem", fontWeight: 600 }}>Cloud features</BaseText>
    },
    enableCloudFeatures: {
        type: OptionType.BOOLEAN,
        description: "Allow the plugin to use the UserpluginLibrary cloud, which includes the plugin library and safety status",
        default: true,
        restartNeeded: true
    },
    cf: {
        type: OptionType.COMPONENT,
        component: () => {
            const [authInfo, setAuthInfo] = useState<TypeOfVWC<typeof auth>>();
            useEffect(() => {
                setAuthInfo(auth.value());
                const id = auth.registerCallback(value => {
                    setAuthInfo(value);
                });
                return () => auth.deregisterCallback(id);
            }, []);
            const rs = settings.use(["enableCloudFeatures"]);
            if (!rs.enableCloudFeatures) return;
            return authInfo?.token ? <>
                <Notice.Info>
                    You are currently logged in as <strong>{authInfo.username}</strong>
                </Notice.Info>
                <Button variant="secondary" onClick={() => {
                }}>Manage my plugins</Button>
                <Flex gap={5}>
                    <Button style={{ flex: 1 } } variant="dangerSecondary" onClick={() => {
                        auth.value({
                            token: undefined,
                            username: undefined
                        });
                        showToast("Logged out", Toasts.Type.SUCCESS);
                    }}>Log out</Button>
                    <Button style={{ flex: 1 } } variant="dangerPrimary" onClick={() => {
                    }}>Clear cloud data</Button>
                </Flex>
            </> : <Button onClick={() => authorize()}>Login to UserpluginLibrary</Button>;
        }
    },
    h2: {
        type: OptionType.COMPONENT,
        component: () => <BaseText style={{ fontSize: "1.2rem", fontWeight: 600 }}>Notification settings</BaseText>
    },
    notifyIfUpdate: {
        type: OptionType.BOOLEAN,
        description: "Show a Vencord notification if UserPlugins need to be updated",
        default: true
    },
    neverNotifyForPlugins: {
        type: OptionType.STRING,
        description: "Never show update notifications for these plugins (you can still update them from the UserPlugins tab)",
        default: ""
    },
    h3: {
        type: OptionType.COMPONENT,
        component: () => <BaseText style={{ fontSize: "1.2rem", fontWeight: 600 }}>Advanced</BaseText>
    },
    allowlistedChannels: {
        type: OptionType.STRING,
        description: "Comma separated list of channels where the Install Plugin button should be displayed. It is always displayed in the Vencord Userplugin channels"
    },
    setGitPath: {
        type: OptionType.COMPONENT,
        component: () => <Button onClick={() => {
            Native.openGitPathModal();
        }} variant="secondary">
            Set Git path
        </Button>
    },
    apiBasePath: {
        type: OptionType.STRING,
        description: "for debug purposes",
        hidden: true,
        default: "https://upl.nin0.dev"
    }
});

export default definePlugin({
    name: "UserpluginLibrary",
    searchTerms: ["UserpluginInstaller"],
    tags: ["Developers"],
    auth,
    description: "Browse and install userplugins directly from your client",
    settingsAboutComponent: () => (
        <Notice.Warning>
            While userplugins in the library are actively reviewed and moderated, Equicord does not take responsibility for anything that may result from installing them.
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
    sectionLib: {
        key: "vencord_userplugins_lib",
        title: "Plugin Library",
        panelTitle: "Plugin Library",
        Component: LibraryTab,
        Icon: ShopSparkleIcon
    },
    async start() {
        if (!VencordNative.pluginHelpers.UserpluginLibrary || !VencordNative.csp.isDomainAllowed(this.settings.store.apiBasePath, ["connect-src"])) return void Alerts.show({
            title: "UserpluginLibrary not fully loaded",
            body: "You need to restart to allow the native to be loaded :)",
            confirmText: "Restart now",
            onConfirm() {
                relaunch();
            },
            cancelText: "Later"
        });

        await Native.ensurePluginsDirectory();

        plSettings.customEntries.push(this.section);
        settings.plain.enableCloudFeatures && plSettings.customEntries.push(this.sectionLib);

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
