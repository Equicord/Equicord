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
            {!settings.store.useCompact &&
                <svg
                    id="vc-friendcount-icon"
                    aria-hidden="true"
                    role="img"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24">
                    <path
                        fill="currentColor"
                        d="M13 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z">
                    </path>
                    <path
                        fill="currentColor"
                        d="M3 5v-.75C3 3.56 3.56 3 4.25 3s1.24.56 1.33 1.25C6.12 8.65 9.46 12 13 12h1a8 8 0 0 1 8 8 2 2 0 0 1-2 2 .21.21 0 0 1-.2-.15 7.65 7.65 0 0 0-1.32-2.3c-.15-.2-.42-.06-.39.17l.25 2c.02.15-.1.28-.25.28H9a2 2 0 0 1-2-2v-2.22c0-1.57-.67-3.05-1.53-4.37A15.85 15.85 0 0 1 3 5Z">
                    </path>
                </svg>
            }
            <BaseText
                size="xs"
                id="vc-friendcount-text">{onlineFriendsCount}
            </BaseText>
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
            {!settings.store.useCompact &&
                <svg
                    id="vc-guildcount-icon"
                    aria-hidden="true"
                    role="img"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24">
                    <path
                        fill="currentColor"
                        d="M10.55 4.4c.13-.24.1-.54-.12-.71L8.6 2.24a1 1 0 0 0-1.24 0l-4 3.15a1 1 0 0 0-.38.79v4.03c0 .43.5.66.82.39l2.28-1.9a3 3 0 0 1 3.84 0c.03.02.08 0 .08-.04V6.42a4 4 0 0 1 .55-2.02ZM7.36 10.23a1 1 0 0 1 1.28 0l1.18.99 2.98 2.48 1.84 1.53a1 1 0 0 1-.67 1.77.1.1 0 0 0-.1.09l-.23 3.06a2 2 0 0 1-2 1.85H4.36a2 2 0 0 1-2-1.85l-.24-3.16a1 1 0 0 1-.76-1.76l6-5Z">
                    </path>
                    <path
                    fill="currentColor"
                    d="M12 10.2c0 .14.07.28.18.38l3.74 3.12a3 3 0 0 1 .03 4.58.55.55 0 0 0-.2.37l-.12 1.65a4 4 0 0 1-.17.9c-.12.38.13.8.52.8H20a2 2 0 0 0 2-2V3.61a1.5 1.5 0 0 0-2-1.41l-6.66 2.33A2 2 0 0 0 12 6.42">
                    </path>
                </svg>
            }
            <BaseText
                size="xs"
                id="vc-guildcount-text">{guildCount}
            </BaseText>
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
