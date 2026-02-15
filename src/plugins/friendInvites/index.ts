/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
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

import { ApplicationCommandInputType, sendBotMessage } from "@api/Commands";
import { Devs } from "@utils/constants";
import { t } from "@utils/translation";
import definePlugin from "@utils/types";
import { findByPropsLazy } from "@webpack";

const FriendInvites = findByPropsLazy("createFriendInvite");

export default definePlugin({
    name: "FriendInvites",
    description: t("friendInvites.description"),
    authors: [Devs.afn, Devs.Dziurwa],
    commands: [
        {
            name: "create friend invite",
            description: t("friendInvites.commands.createFriendInvite.description"),
            inputType: ApplicationCommandInputType.BUILT_IN,

            execute: async (args, ctx) => {
                const invite = await FriendInvites.createFriendInvite();

                sendBotMessage(ctx.channel.id, {
                    content: `
                        discord.gg/${invite.code} ·
                        ${t("friendInvites.ui.expires")} <t:${new Date(invite.expires_at).getTime() / 1000}:R> ·
                        ${t("friendInvites.ui.maxUses")} \`${invite.max_uses}\`
                    `.trim().replace(/\s+/g, " ")
                });
            }
        },
        {
            name: "view friend invites",
            description: t("friendInvites.commands.viewFriendInvites.description"),
            inputType: ApplicationCommandInputType.BUILT_IN,
            execute: async (_, ctx) => {
                const invites = await FriendInvites.getAllFriendInvites();
                const friendInviteList = invites.map(i =>
                    `
                    _discord.gg/${i.code}_ ·
                    ${t("friendInvites.ui.expires")} <t:${new Date(i.expires_at).getTime() / 1000}:R> ·
                    ${t("friendInvites.ui.timesUsed")} \`${i.uses}/${i.max_uses}\`
                    `.trim().replace(/\s+/g, " ")
                );

                sendBotMessage(ctx.channel.id, {
                    content: friendInviteList.join("\n") || t("friendInvites.ui.noActiveInvites")
                });
            },
        },
        {
            name: "revoke friend invites",
            description: t("friendInvites.commands.revokeFriendInvites.description"),
            inputType: ApplicationCommandInputType.BUILT_IN,
            execute: async (_, ctx) => {
                await FriendInvites.revokeFriendInvites();

                sendBotMessage(ctx.channel.id, {
                    content: t("friendInvites.ui.allRevoked")
                });
            },
        },
    ]
});
