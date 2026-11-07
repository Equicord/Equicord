/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { Text } from "@components/Text";
import { Tooltip } from "@webpack/common";

export function StockPluginsCard({ totalStockPlugins, enabledStockPlugins }) {
    return (
        <div className="vc-plugin-stats vc-stockplugins-stats-card">
            <div className="vc-plugin-stats-card-container">
                <div className="vc-plugin-stats-card-section">
                    <Text size="md" weight="semibold">Enabled Plugins</Text>
                    <Text size="xl" weight="bold">{enabledStockPlugins}</Text>
                </div>
                <div className="vc-plugin-stats-card-divider"></div>
                <div className="vc-plugin-stats-card-section">
                    <Text size="md" weight="semibold">Total Plugins</Text>
                    <Text size="xl" weight="bold">{totalStockPlugins}</Text>
                </div>
            </div>
        </div>
    );
}

export function UserPluginsCard({ totalUserPlugins, enabledUserPlugins }) {
    if (totalUserPlugins === 0)
        return (
            <div className="vc-plugin-stats vc-stockplugins-stats-card">
                <div className="vc-plugin-stats-card-container ">
                    <div className="vc-plugin-stats-card-section">
                        <Text size="md" weight="semibold">Total Userplugins</Text>
                        <Tooltip
                            text={
                                <img
                                    src="/assets/ab6835d2922224154ddf.svg"
                                    style={{ width: "40px", height: "40px" }}
                                />
                            }
                        >
                            {tooltipProps => (
                                <span style={{ display: "inline", position: "relative" }}>
                                    <Text size="xl" weight="bold" {...tooltipProps}>
                                        {totalUserPlugins}
                                    </Text>
                                </span>
                            )}
                        </Tooltip>
                    </div>
                </div>
            </div>
        );
    else
        return (
            <div className="vc-plugin-stats vc-stockplugins-stats-card">
                <div className="vc-plugin-stats-card-container">
                    <div className="vc-plugin-stats-card-section">
                        <Text size="md" weight="semibold">Enabled Userplugins</Text>
                        <Text size="xl" weight="bold">{enabledUserPlugins}</Text>
                    </div>
                    <div className="vc-plugin-stats-card-divider"></div>
                    <div className="vc-plugin-stats-card-section">
                        <Text size="md" weight="semibold">Total Userplugins</Text>
                        <Text size="xl" weight="bold">{totalUserPlugins}</Text>
                    </div>
                </div>
            </div>
        );
}
