/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Settings } from "@api/Settings";
import { classNameFactory } from "@api/Styles";
import { PluginCard } from "@components/settings/tabs/plugins/PluginCard";
import { ChangeList } from "@utils/ChangeList";
import { Margins } from "@utils/margins";
import { useForceUpdater } from "@utils/react";
import { Button, Card, Forms, React, Text, Tooltip } from "@webpack/common";

import Plugins from "~plugins";

const cl = classNameFactory("vc-changelog-");

interface NewPluginsSectionProps {
    newPlugins: string[];
    onPluginToggle?: (pluginName: string, enabled: boolean) => void;
}

export function NewPluginsSection({
    newPlugins,
    onPluginToggle,
}: NewPluginsSectionProps) {
    const changes = React.useMemo(() => new ChangeList<string>(), []);
    const forceUpdate = useForceUpdater();

    const mapPlugins = (array: string[]) =>
        array
            .map((pn) => Plugins[pn])
            .filter((p) => p && !p.hidden)
            .sort((a, b) => a.name.localeCompare(b.name));

    const sortedPlugins = React.useMemo(
        () => mapPlugins(newPlugins),
        [newPlugins],
    );

    if (sortedPlugins.length === 0) {
        return null;
    }

    const handlePluginToggle = (pluginName: string, enabled: boolean) => {
        onPluginToggle?.(pluginName, enabled);
    };

    return (
        <div className={cl("new-plugins-section")}>
            <Forms.FormTitle tag="h5" className={Margins.bottom8}>
                New Plugins ({sortedPlugins.length})
            </Forms.FormTitle>

            <Forms.FormText className={Margins.bottom16}>
                The following plugins have been added in recent updates:
            </Forms.FormText>

            <div className={cl("new-plugins-grid")}>
                {sortedPlugins.map((plugin) => (
                    <Card key={plugin.name} className={cl("new-plugin-card")}>
                        <PluginCard
                            onRestartNeeded={(name) => {
                                changes.handleChange(name);
                                forceUpdate();
                            }}
                            disabled={false}
                            plugin={plugin}
                            isNew={true}
                        />
                    </Card>
                ))}
            </div>

            {changes.hasChanges && (
                <div className={cl("restart-notice")}>
                    <Tooltip
                        text={
                            <>
                                The following plugins require a restart:
                                <div className={Margins.bottom8} />
                                <ul>
                                    {changes.map((p) => (
                                        <li key={p}>{p}</li>
                                    ))}
                                </ul>
                            </>
                        }
                    >
                        {(tooltipProps) => (
                            <Button
                                {...tooltipProps}
                                color={Button.Colors.YELLOW}
                                size={Button.Sizes.SMALL}
                                onClick={() => location.reload()}
                                className={Margins.top16}
                            >
                                Restart Required
                            </Button>
                        )}
                    </Tooltip>
                </div>
            )}
        </div>
    );
}

interface NewPluginsCompactProps {
    newPlugins: string[];
    maxDisplay?: number;
}

export function NewPluginsCompact({
    newPlugins,
    maxDisplay = 5,
}: NewPluginsCompactProps) {
    if (newPlugins.length === 0) {
        return null;
    }

    const displayPlugins = newPlugins.slice(0, maxDisplay);
    const hasMore = newPlugins.length > maxDisplay;

    return (
        <div className={cl("new-plugins-compact")}>
            <div className={cl("new-plugins-list")}>
                {displayPlugins
                    .map((pluginName) => {
                        const plugin = Plugins[pluginName];
                        return plugin && !plugin.hidden ? (
                            <span
                                key={pluginName}
                                className={cl("new-plugin-tag")}
                            >
                                {plugin.name}
                            </span>
                        ) : null;
                    })
                    .filter(Boolean)}

                {hasMore && (
                    <span className={cl("new-plugin-tag", "more")}>
                        +{newPlugins.length - maxDisplay} more
                    </span>
                )}
            </div>
        </div>
    );
}
