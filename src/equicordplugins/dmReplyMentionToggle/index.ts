/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import type { Channel, Message } from "@vencord/discord-types";
import { UserStore } from "@webpack/common";

export default definePlugin({
    name: "DMReplyMentionToggle",
    description: "Shows the reply mention toggle in DMs and group DMs.",
    authors: [EquicordDevs.Rockykln],

    patches: [
        {
            find: '"PendingReplyStore"',
            replacement: {
                match: /CREATE_PENDING_REPLY:function\((\i)\){let{channel:(\i),message:(\i),shouldMention:\i=!0,showMentionToggle:(\i)=!0[^}]{0,80}}=\1;/,
                replace: "$&$4=$self.showToggle($4,$2,$3);"
            }
        }
    ],

    showToggle(show: boolean, channel: Channel, message: Message) {
        if (show || !channel.isPrivate()) return show;
        return message.author.id !== UserStore.getCurrentUser().id;
    }
});
