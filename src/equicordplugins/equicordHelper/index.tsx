/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "@equicordplugins/_misc/styles.css";

import { definePluginSettings, useSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { WarningIcon } from "@components/Icons";
import { AddonCard } from "@components/settings";
import { ExcludedReasons, PluginDependencyList } from "@components/settings/tabs/plugins";
import { PluginCard } from "@components/settings/tabs/plugins/PluginCard";
import { Devs, EQUIBOT_USER_ID, EquicordDevs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import { isEquicordGuild, isEquicordSupport } from "@utils/misc";
import definePlugin, { OptionType } from "@utils/types";
import { Message } from "@vencord/discord-types";
import { Button, Flex, showToast, Toasts, Tooltip, TooltipContainer } from "@webpack/common";
import { JSX } from "react";

import plugins, { ExcludedPlugins } from "~plugins";

import { toggleEnabled } from "./utils";

const settings = definePluginSettings({
    disableCreateDMButton: {
        type: OptionType.BOOLEAN,
        description: "Disables the create dm button",
        restartNeeded: true,
        default: false,
    },
    disableDMContextMenu: {
        type: OptionType.BOOLEAN,
        description: "Disables the DM list context menu in favor of the x button",
        restartNeeded: true,
        default: false
    }
});

export default definePlugin({
    name: "EquicordHelper",
    description: "Used to provide support, fix discord caused crashes, and other misc features.",
    authors: [Devs.thororen, EquicordDevs.nyx, EquicordDevs.Naibuu],
    required: true,
    settings,
    patches: [
        // Fixes Unknown Resolution/FPS Crashing
        {
            find: "Unknown resolution:",
            replacement: [
                {
                    match: /throw Error\("Unknown resolution: ".concat\((\i)\)\)/,
                    replace: "return $1;"
                },
                {
                    match: /throw Error\("Unknown frame rate: ".concat\((\i)\)\)/,
                    replace: "return $1;"
                }
            ]
        },
        {
            find: ".createDMButtonContainer,",
            replacement: {
                match: /"create-dm"\)/,
                replace: "$&&&false"
            },
            predicate: () => settings.store.disableCreateDMButton
        },
        {
            find: "#{intl::d+e27u::raw}",
            replacement: {
                match: /\{dotsInsteadOfCloseButton:(\i),rearrangeContextMenu:(\i).*?autoTrackExposure:!0\}\)/,
                replace: "$1=false,$2=false"
            },
            predicate: () => settings.store.disableDMContextMenu
        },
    ],
    renderMessageAccessory(props) {
        return pluginButtons(props);
    }
});

function pluginButtons(props) {
    const buttons = [] as JSX.Element[];
    const msg = props.message.content?.toLowerCase() ?? "";

    const contentWords = (msg.match(/`\w+`/g) ?? []).map(e => e.slice(1, -1));
    const matchedPlugins = Object.keys(Vencord.Plugins.plugins).filter(name => contentWords.includes(name.toLowerCase()));
    const matchedPlugin = matchedPlugins.sort((a, b) => b.length - a.length)[0];
    const pluginData = matchedPlugin ? Vencord.Plugins.plugins[matchedPlugin] : null;

    const isEquicord = isEquicordGuild(props.channel.id) && isEquicordSupport(props.message.author.id);
    const startsWithEnabled = msg.startsWith("enable");
    const startsWithDisabled = msg.startsWith("disable");

    const shouldAddPluginButtons = pluginData && isEquicord && (startsWithEnabled || startsWithDisabled);

    if (shouldAddPluginButtons) {
        if (pluginData.required || pluginData.name.endsWith("API")) return;
        const isEnabled = Vencord.Plugins.isPluginEnabled(matchedPlugin);

        let label = `${matchedPlugin} is already ${isEnabled ? "enabled" : "disabled"}`;
        let disabled = true;

        if ((startsWithDisabled && isEnabled) || (startsWithEnabled && !isEnabled)) {
            label = `${isEnabled ? "Disable" : "Enable"} ${matchedPlugin}`;
            disabled = false;
        }

        buttons.push(
            <Button
                key="vc-plugin-toggle"
                color={disabled ? Button.Colors.PRIMARY : (isEnabled ? Button.Colors.RED : Button.Colors.GREEN)}
                disabled={disabled}
                size={Button.Sizes.SMALL}
                onClick={async () => {
                    try {
                        const success = await toggleEnabled(matchedPlugin);
                        if (success) showToast(`${label}`, Toasts.Type.SUCCESS);
                    } catch (e) {
                        new Logger("EquicordHelper").error("Error while toggling:", e);
                        showToast(`Failed to ${label.toLowerCase()}`, Toasts.Type.FAILURE);
                    }
                }}
            >
                {label}
            </Button>
        );
    }

    return (
        <>
            {buttons.length > 0 && <Flex>{buttons}</Flex>}
            <PluginCards message={props.message} />
        </>
    );
}


function ChatPluginCard({ url, description }: { url: string, description: string; }) {
    const pluginNameFromUrl = new URL(url).pathname.split("/")[2];

    const actualPluginName = Object.keys(plugins).find(name =>
        name.toLowerCase() === pluginNameFromUrl?.toLowerCase()
    );

    const pluginName = actualPluginName || pluginNameFromUrl;

    useSettings([`plugins.${pluginName ?? ""}.enabled`]);

    if (!pluginName) return null;

    const p = plugins[pluginName];
    const excludedPlugin = ExcludedPlugins[pluginName];

    if (excludedPlugin || !p) {
        const toolTipText = !p
            ? `${pluginName} is only available on the ${ExcludedReasons[ExcludedPlugins[pluginName]]}`
            : "This plugin is not on this version of Equicord. Try updating!";

        const card = (
            <AddonCard
                name={pluginName}
                description={description || toolTipText}
                enabled={false}
                setEnabled={() => { }}
                disabled={true}
                infoButton={<WarningIcon />}
            />
        );

        return description
            ? <TooltipContainer text={toolTipText}>{card}</TooltipContainer>
            : card;
    }

    const onRestartNeeded = () => showToast("A restart is required for the change to take effect!");

    const required = Vencord.Plugins.isPluginRequired(pluginName);
    const dependents = Vencord.Plugins.calculatePluginDependencyMap()[p.name]?.filter(d => Vencord.Plugins.isPluginEnabled(d));

    if (required) {
        const tooltipText = p.required || !dependents.length
            ? "This plugin is required for Equicord to function."
            : <PluginDependencyList deps={dependents} />;

        return (
            <Tooltip text={tooltipText} key={p.name}>
                {({ onMouseLeave, onMouseEnter }) =>
                    <PluginCard
                        key={p.name}
                        onMouseLeave={onMouseLeave}
                        onMouseEnter={onMouseEnter}
                        onRestartNeeded={onRestartNeeded}
                        plugin={p}
                        disabled
                    />
                }
            </Tooltip>
        );
    }

    return (
        <PluginCard
            key={p.name}
            onRestartNeeded={onRestartNeeded}
            plugin={p}
        />
    );
}

const PluginCards = ErrorBoundary.wrap(function PluginCards({ message }: { message: Message; }) {
    const seenPlugins = new Set<string>();
    const pluginCards: JSX.Element[] = [];

    // Process embeds
    message.embeds?.forEach(embed => {
        if (!embed.url?.startsWith("https://equicord.org/plugins/") && !embed.url?.startsWith("https://vencord.dev/plugins/")) return;

        const pluginNameFromUrl = new URL(embed.url).pathname.split("/")[2];
        const actualPluginName = Object.keys(plugins).find(name =>
            name.toLowerCase() === pluginNameFromUrl?.toLowerCase()
        );
        const pluginName = actualPluginName || pluginNameFromUrl;

        if (!pluginName || seenPlugins.has(pluginName)) return;
        seenPlugins.add(pluginName);

        pluginCards.push(
            <ChatPluginCard
                key={embed.url}
                url={embed.url}
                description={embed.rawDescription}
            />
        );
    });

    // Process components
    const components = (message.components?.[0] as any)?.components;
    if (message.author.id === EQUIBOT_USER_ID && components?.length >= 4) {
        const description = components[1]?.content;
        const pluginUrl = components.find((c: any) => c?.components)?.components[0]?.url;
        if (pluginUrl?.startsWith("https://equicord.org/plugins/") || pluginUrl?.startsWith("https://vencord.dev/plugins/")) {
            const pluginNameFromUrl = new URL(pluginUrl).pathname.split("/")[2];
            const actualPluginName = Object.keys(plugins).find(name =>
                name.toLowerCase() === pluginNameFromUrl?.toLowerCase()
            );
            const pluginName = actualPluginName || pluginNameFromUrl;

            if (pluginName && !seenPlugins.has(pluginName)) {
                seenPlugins.add(pluginName);
                pluginCards.push(
                    <ChatPluginCard
                        key={pluginUrl}
                        url={pluginUrl}
                        description={description}
                    />
                );
            }
        }
    }

    if (pluginCards.length === 0) return null;

    return (
        <div className="vc-plugins-grid" style={{ marginTop: "0px" }}>
            {pluginCards}
        </div>
    );
}, { noop: true });
