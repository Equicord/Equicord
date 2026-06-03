/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { ChannelStore, UserSettingsActionCreators } from "@webpack/common";

function getGuildAndChannels(): Record<string, { totalUses: number; }> | null {
    const { guildAndChannelFrecency } = UserSettingsActionCreators.FrecencyUserSettingsActionCreators.getCurrentValue() ?? {};
    return guildAndChannelFrecency?.guildAndChannels ?? null;
}

function generateSearchResults(query: string) {
    const guildAndChannels = getGuildAndChannels();
    if (!guildAndChannels) return null;

    const normalizedQuery = query.toLowerCase();

    const frequentChannelsWithQuery = Object.keys(guildAndChannels)
        .filter(id => {
            const channel = ChannelStore.getChannel(id);
            return channel != null && channel.name.toLowerCase().includes(normalizedQuery);
        })
        .sort((id1, id2) => (guildAndChannels[id2]?.totalUses ?? 0) - (guildAndChannels[id1]?.totalUses ?? 0))
        .slice(0, 20);

    return frequentChannelsWithQuery.map(channelID => {
        const channel = ChannelStore.getChannel(channelID)!;
        return {
            type: "TEXT_CHANNEL",
            record: channel,
            score: 20,
            comparator: query,
            sortable: query
        };
    });
}

export default definePlugin({
    name: "FrequentQuickSwitcher",
    description: "Rewrites and filters the quick switcher results to be your most frequent channels",
    tags: ["Shortcuts", "Servers"],
    authors: [Devs.Samwich],
    generateSearchResults,
    start() {
        UserSettingsActionCreators.FrecencyUserSettingsActionCreators.loadIfNecessary();
    },
    patches: [
        {
            find: "#{intl::QUICKSWITCHER_PLACEHOLDER}",
            replacement: {
                match: /let{selectedIndex:\i,results:\i}/,
                replace: "var _fqsResults=$self.generateSearchResults(this.state.query);if(_fqsResults!=null)this.props.results=_fqsResults;$&"
            },
        }
    ]
});
