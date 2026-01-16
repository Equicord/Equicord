/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, findOption, RequiredMessageOption } from "@api/Commands";
import { definePluginSettings } from "@api/Settings";
import { TestcordDevs } from "@utils/constants"; // Ensure this exists in your constants, otherwise replace with VencordDevs FIX: Imported from correct location
import { sendMessage } from "@utils/discord";
import definePlugin, { OptionType } from "@utils/types";
import { CommandArgument, CommandContext } from "@vencord/discord-types";
import { ChannelStore, RelationshipStore } from "@webpack/common";

export default definePlugin({
    name: "SendToAllDMs",
    description: "Adds a command to send a message to all friends' DMs with blacklist/whitelist settings. WE CANNOT GUARANTEE THIS PLUGIN WON'T GET YOU BANNED.",
    authors: [TestcordDevs.x2b],
    settings: definePluginSettings({
        sendToAllDMs: {
            type: OptionType.BOOLEAN,
            description: "If true, send to all DMs. If false, send only to friends.",
            default: false
        },
        useWhitelist: {
            type: OptionType.BOOLEAN,
            description: "If true, use whitelist mode (only send to listed IDs). If false, use blacklist mode (exclude listed IDs).",
            default: false
        },
        userIds: {
            type: OptionType.STRING,
            description: "Comma-separated list of user IDs for blacklist/whitelist",
            default: ""
        }
    }),
    commands: [
        {
            name: "sendtoalldms",
            description: "Send a message to all friends' DMs",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [RequiredMessageOption],
            execute: async (opts: CommandArgument[], ctx: CommandContext) => {
                const message = findOption(opts, "message", "");
                if (!message) return;

                let friends = RelationshipStore.getFriendIDs();

                // Access settings safely.
                // Note: If this crashes, 'settings' might not be initialized correctly,
                // but usually this works if the plugin loads.
                const { useWhitelist, userIds } = (Vencord.Plugins.plugins.SendToAllDMs as any).settings.store;
                const idList = userIds.split(",").map(id => id.trim()).filter(id => id);

                if (useWhitelist) {
                    friends = friends.filter(id => idList.includes(id));
                } else {
                    friends = friends.filter(id => !idList.includes(id));
                }

                const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

                for (const userId of friends) {
                    try {
                        const channelId = ChannelStore.getDMFromUserId(userId);
                        if (channelId) {
                            await sendMessage(channelId, { content: message });
                            // Rate limit delay to prevent account action
                            await sleep(1000);
                        }
                    } catch (e) {
                        console.error(`Failed to send message to ${userId}:`, e);
                    }
                }
            }
        }
    ]
});
