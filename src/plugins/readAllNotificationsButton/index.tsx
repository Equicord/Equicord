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

import { addServerListElement, removeServerListElement, ServerListItem, ServerListRenderPosition } from "@api/ServerList";
import { Devs, EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { ActiveJoinedThreadsStore, FluxDispatcher, GuildChannelStore, GuildStore, React, ReadStateStore } from "@webpack/common";

function onClick() {
    const channels: Array<any> = [];

    Object.values(GuildStore.getGuilds()).forEach(guild => {
        GuildChannelStore.getChannels(guild.id).SELECTABLE
            .concat(GuildChannelStore.getChannels(guild.id).VOCAL)
            .concat(
                Object.values(ActiveJoinedThreadsStore.getActiveJoinedThreadsForGuild(guild.id))
                    .flatMap(threadChannels => Object.values(threadChannels))
            )
            .forEach((c: { channel: { id: string; }; }) => {
                if (!ReadStateStore.hasUnread(c.channel.id)) return;

                channels.push({
                    channelId: c.channel.id,
                    messageId: ReadStateStore.lastMessageId(c.channel.id),
                    readStateType: 0
                });
            });
    });

    FluxDispatcher.dispatch({
        type: "BULK_ACK",
        context: "APP",
        channels: channels
    });
}

const DoubleCheckmark = () => {
    return (
        <svg
            id="vc-ranb-icon"
            aria-hidden="true"
            role="img"
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            fill="none"
            viewBox="0 0 24 24">
            <path
                fill="currentColor"
                d="M16.7 8.7a1 1 0 0 0-1.4-1.4l-3.26 3.24a1 1 0 0 0 1.42 1.42L16.7 8.7ZM3.7 11.3a1 1 0 0 0-1.4 1.4l4.5 4.5a1 1 0 0 0 1.4-1.4l-4.5-4.5Z">
            </path>
            <path
                fill="currentColor"
                d="M21.7 9.7a1 1 0 0 0-1.4-1.4L13 15.58l-3.3-3.3a1 1 0 0 0-1.4 1.42l4 4a1 1 0 0 0 1.4 0l8-8Z">
            </path>
        </svg>
    );
};

export default definePlugin({
    name: "ReadAllNotificationsButton",
    description: "Read all server notifications with a single button click!",
    tags: ["Notifications", "Shortcuts"],
    authors: [Devs.kemo, EquicordDevs.KrystalSkull],
    dependencies: ["ServerListAPI"],

    renderButton() {
        return (
            <ServerListItem
                id="vc-ranb-button-container"
                icon={DoubleCheckmark}
                tooltip="Read All"
                onClick={onClick}
            />
        );
    },

    start() {
        addServerListElement(ServerListRenderPosition.Above, this.renderButton);
    },

    stop() {
        removeServerListElement(ServerListRenderPosition.Above, this.renderButton);
    }
});
