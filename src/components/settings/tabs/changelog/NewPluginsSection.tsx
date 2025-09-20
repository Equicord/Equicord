/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Settings, useSettings } from "@api/Settings";
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
    const settings = useSettings();
    const changes = React.useMemo(() => new ChangeList<string>(), []);
    const forceUpdate = useForceUpdater();

    const depMap = React.useMemo(() => {
        const o = {} as Record<string, string[]>;
        for (const plugin in Plugins) {
            const deps = Plugins[plugin].dependencies;
            if (deps) {
                for (const dep of deps) {
                    o[dep] ??= [];
                    o[dep].push(plugin);
                }
            }
        }
        return o;
    }, []);

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

    const makeDependencyList = (deps: string[]) => {
        return (
            <React.Fragment>
                <Forms.FormText>This plugin is required by:</Forms.FormText>
                {deps.map((dep: string) => (
                    <Forms.FormText key={dep} className="vc-changelog-dep-text">
                        {dep}
                    </Forms.FormText>
                ))}
            </React.Fragment>
        );
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
                {sortedPlugins.map((plugin) => {
                    const isRequired =
                        plugin.required ||
                        depMap[plugin.name]?.some(
                            (d) => settings.plugins[d].enabled,
                        );
                    const tooltipText = plugin.required
                        ? "This plugin is required for Vencord to function."
                        : makeDependencyList(
                              depMap[plugin.name]?.filter(
                                  (d) => settings.plugins[d].enabled,
                              ),
                          );

                    if (isRequired) {
                        return (
                            <Tooltip text={tooltipText} key={plugin.name}>
                                {({ onMouseLeave, onMouseEnter }) => (
                                    <Card
                                        className={cl(
                                            "new-plugin-card",
                                            "required",
                                        )}
                                    >
                                        <PluginCard
                                            onMouseLeave={onMouseLeave}
                                            onMouseEnter={onMouseEnter}
                                            onRestartNeeded={(name) => {
                                                changes.handleChange(name);
                                                forceUpdate();
                                            }}
                                            disabled={true}
                                            plugin={plugin}
                                            isNew={true}
                                        />
                                    </Card>
                                )}
                            </Tooltip>
                        );
                    }

                    return (
                        <Card
                            key={plugin.name}
                            className={cl("new-plugin-card")}
                        >
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
                    );
                })}
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
    const settings = useSettings();

    const depMap = React.useMemo(() => {
        const o = {} as Record<string, string[]>;
        for (const plugin in Plugins) {
            const deps = Plugins[plugin].dependencies;
            if (deps) {
                for (const dep of deps) {
                    o[dep] ??= [];
                    o[dep].push(plugin);
                }
            }
        }
        return o;
    }, []);

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
                        if (!plugin || plugin.hidden) return null;

                        const isRequired =
                            plugin.required ||
                            depMap[plugin.name]?.some(
                                (d) => settings.plugins[d].enabled,
                            );

                        const tooltipText = plugin.required
                            ? "This plugin is required for Vencord to function."
                            : depMap[plugin.name]?.length > 0
                              ? `This plugin is required by: ${depMap[
                                    plugin.name
                                ]
                                    ?.filter((d) => settings.plugins[d].enabled)
                                    .join(", ")}`
                              : null;

                        return (
                            <Tooltip
                                text={tooltipText}
                                key={pluginName}
                                shouldShow={isRequired}
                            >
                                {(tooltipProps) => (
                                    <span
                                        {...tooltipProps}
                                        className={`${cl("new-plugin-tag")}${isRequired ? ` ${cl("new-plugin-tag", "required")}` : ""}`}
                                        title={
                                            isRequired
                                                ? "Required plugin"
                                                : undefined
                                        }
                                    >
                                        {plugin.name}
                                        {isRequired && " *"}
                                    </span>
                                )}
                            </Tooltip>
                        );
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
