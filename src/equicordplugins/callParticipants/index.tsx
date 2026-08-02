/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import definePlugin from "@utils/types";
import { MessageType } from "@vencord/discord-types/enums";
import { ChannelStore, UserStore, UserSummaryItem } from "@webpack/common";

const cl = classNameFactory("vc-callParticipants-");

export default definePlugin({
    name: "CallParticipants",
    description: "Shows the participants of a call next to the call message.",
    authors: [EquicordDevs.qdnx],

    renderMessageAccessory({ message }) {
        if (message.type !== MessageType.CALL || !message.call) return null;

        const users = message.call.participants
            .map(id => UserStore.getUser(id))
            .filter(Boolean);

        if (!users.length) return null;

        return (
            <div className={cl("root")}>
                <UserSummaryItem
                    users={users}
                    guildId={ChannelStore.getChannel(message.channel_id)?.guild_id}
                    renderIcon={false}
                    max={5}
                    showDefaultAvatarsForNullUsers
                    showUserPopout
                />
            </div>
        );
    },
});
