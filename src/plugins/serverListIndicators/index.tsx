/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Sofia Lima
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

import "./styles.css";

import { addServerListElement, removeServerListElement, ServerListItem, ServerListRenderPosition } from "@api/ServerList";
import { definePluginSettings } from "@api/Settings";
import { BaseText } from "@components/BaseText";
import { FriendsIcon } from "@equicordplugins/channelTabs/util";
import { ServerIcon } from "@equicordplugins/commandPalette/ui/icons";
import { Devs, EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import definePlugin, { OptionType } from "@utils/types";
import { GuildStore, PresenceStore, RelationshipStore, UserGuildJoinRequestStore, useStateFromStores } from "@webpack/common";

const enum IndicatorType {
    SERVER = 1 << 0,
    FRIEND = 1 << 1,
    BOTH = SERVER | FRIEND,
}

let onlineFriendsCount = 0;
let guildCount = 0;

function FriendsIndicator() {
    onlineFriendsCount = useStateFromStores([RelationshipStore, PresenceStore], () => {
        let count = 0;

        const friendIds = RelationshipStore.getFriendIDs();
        for (const id of friendIds) {
            const status = PresenceStore.getStatus(id) ?? "offline";
            if (status === "offline") {
                continue;
            }

            count++;
        }

        return count;
    });

    return (
        <div id="vc-friendcount">
            {!settings.store.useCompact && <FriendsIcon/>}
            <BaseText size="xs" id="vc-friendcount-text">{onlineFriendsCount}</BaseText>
            {!!settings.store.useCompact && <BaseText size="xs" id="vc-friendcount-text-compact">Friends</BaseText>}
        </div>
    );
}

function ServersIndicator() {
    guildCount = useStateFromStores([GuildStore, UserGuildJoinRequestStore], () => {
        const guildJoinRequests: string[] = UserGuildJoinRequestStore.computeGuildIds();
        const guilds = GuildStore.getGuilds();

        // Filter only pending guild join requests
        return GuildStore.getGuildCount() + guildJoinRequests.filter(id => guilds[id] == null).length;
    });

    return (
        <div id="vc-guildcount">
            {!settings.store.useCompact && <ServerIcon/>}
            <BaseText size="xs" id="vc-guildcount-text">{guildCount}</BaseText>
            {!!settings.store.useCompact && <BaseText size="xs" id="vc-guildcount-text-compact">Servers</BaseText>}
        </div>
    );
}

export const settings = definePluginSettings({
    mode: {
        description: "Mode",
        type: OptionType.SELECT,
        options: [
            { label: "Only online friend count", value: IndicatorType.FRIEND, default: true },
            { label: "Only server count", value: IndicatorType.SERVER },
            { label: "Both server and online friend counts", value: IndicatorType.BOTH },
        ],
        restartNeeded: false
    },
    useCompact: {
        description: "Makes the indicator appear with only text",
        type: OptionType.BOOLEAN,
        default: false,
        restartNeeded: false
    }
});

export default definePlugin({
    name: "ServerListIndicators",
    description: "Add online friend count or server count in the server list",
    tags: ["Servers", "Appearance"],
    authors: [Devs.Rini, EquicordDevs.Panniku],
    dependencies: ["ServerListAPI"],
    settings,

    renderIndicator: () => {
        const { mode, useCompact } = settings.store;
        let text: string;
        // switch is simply better
        switch (mode) {
            case IndicatorType.BOTH:
                text = `${onlineFriendsCount} Friends, ${guildCount} Servers`;
                break;
            case IndicatorType.FRIEND:
                text = `${onlineFriendsCount} Friends`;
                break;
            case IndicatorType.SERVER:
                text = `${guildCount} Servers`;
                break;
        }

        const cl = useCompact ? classNameFactory("vc-indicators-compact-") : classNameFactory("vc-indicators-");

        const items = () => {
            return (
                <div
                    id={cl("indicator-items")}>
                    {!!(mode & IndicatorType.FRIEND) && <FriendsIndicator />}
                    {!!(mode & IndicatorType.SERVER) && <ServersIndicator />}
                </div>
            );
        };

        return useCompact ? (
            items()
        ) : (
            <ServerListItem
                id={cl("container")}
                icon={items}
                tooltip={text}
            />
        );
    },

    start() {
        addServerListElement(ServerListRenderPosition.Above, this.renderIndicator);
    },

    stop() {
        removeServerListElement(ServerListRenderPosition.Above, this.renderIndicator);
    }
});
