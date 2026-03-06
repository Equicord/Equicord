/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Notice } from "@components/Notice";
import { Devs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { RestAPI, UserStore } from "@webpack/common";

const logger = new Logger("AutoReactions");

const settings = definePluginSettings({
    reactions: {
        type: OptionType.STRING,
        default: "hello::wave:,thanks::pray:,skull::skull:",
        description: "Comma-separated list of trigger:emoji pairs (e.g., hello::wave:,thanks::pray:,skull::skull:)"
    },
    reactToOwnMessages: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "React to your own messages"
    },
    allowedUsers: {
        type: OptionType.STRING,
        default: "",
        description: "Comma-separated list of user IDs to react to (empty = react to everyone)"
    },
    ignoredGuilds: {
        type: OptionType.STRING,
        default: "",
        description: "Comma-separated list of guild IDs to ignore (empty = react in all guilds)"
    },
    rateLimitDelay: {
        type: OptionType.SLIDER,
        default: 3000,
        markers: [500, 1000, 2000, 3000, 5000, 10000],
        description: "Delay between reactions in milliseconds (3000 = 3 seconds recommended)"
    }
});

const processedMessages = new Set<string>();

export default definePlugin({
    name: "AutoReactions",
    description: "Automatically react to messages.",
    authors: [Devs.playfairs],
    settings,
    settingsAboutComponent: () => (
        <Notice.Warning>
            We can't guarantee this plugin won't get you warned or banned, you will probably also be assumed a selfbot.
        </Notice.Warning>
    ),

    flux: {
        MESSAGE_CREATE({ message }: { message: any; }) {
            if (processedMessages.has(message.id)) {
                return;
            }

            processedMessages.add(message.id);

            if (processedMessages.size > 100) {
                const firstId = processedMessages.values().next().value;
                if (firstId) {
                    processedMessages.delete(firstId);
                }
            }

            if (message.author?.bot && !settings.store.allowedUsers.includes(message.author.id)) {
                return;
            }

            const ignoredGuilds = settings.store.ignoredGuilds
                .split(",")
                .map(id => id.trim())
                .filter(id => id.length > 0);

            if (message.guild_id && ignoredGuilds.includes(message.guild_id)) {
                logger.info("Guild is ignored, skipping", { guildId: message.guild_id });
                return;
            }

            const allowedUsers = settings.store.allowedUsers
                .split(",")
                .map(id => id.trim())
                .filter(id => id.length > 0);

            if (allowedUsers.length > 0 && !allowedUsers.includes(message.author.id)) {
                return;
            }

            const currentUser = UserStore.getCurrentUser();
            if (message.author.id === currentUser.id && !settings.store.reactToOwnMessages) {
                return;
            }

            logger.info("Processing message", { messageId: message.id, author: message.author?.username, content: message.content?.slice(0, 50) });

            setTimeout(() => {
                const reactions = settings.store.reactions
                    .split(",")
                    .map(pair => pair.trim())
                    .filter(pair => pair.length > 0);

                logger.info("Parsed reactions", { reactions, rawReactions: settings.store.reactions });

                const messageContent = message.content?.toLowerCase() || "";
                let reactionAdded = false;
                let delayAccumulator = 0;

                for (const reaction of reactions) {
                    const parts = reaction.split(":").map(s => s.trim());

                    if (parts.length === 2 && parts[0] && parts[1]) {
                        const [trigger, emoji] = parts;
                        logger.info("Checking trigger:emoji pair", { trigger, emoji, messageContainsTrigger: messageContent.includes(trigger.toLowerCase()) });

                        if (messageContent.includes(trigger.toLowerCase())) {
                            logger.info("Trigger found, adding reaction", { emoji, messageId: message.id });
                            setTimeout(() => {
                                RestAPI.put({
                                    url: `/channels/${message.channel_id}/messages/${message.id}/reactions/${encodeURIComponent(emoji)}/@me`,
                                    body: {}
                                }).then(() => {
                                    logger.info("Reaction added successfully", { emoji });
                                }).catch(err => {
                                    logger.error("Failed to add reaction", err);
                                });
                            }, delayAccumulator);
                            reactionAdded = true;
                            delayAccumulator += 2000;
                        }
                    } else if (reaction.startsWith(":") && reaction.endsWith(":")) {
                        const emojiMap: { [key: string]: string; } = { // There's 100% a better way to do this,
                            // I couldn't get custom emojis to work for some reason
                            // If someone can assist with this, thanks. I'm not that fond of TypeScript.
                            // -----
                            // TODO: Add support for custom emojis and default emojis using their ID,
                            // since when I do try to (I did try to implement it) it just returns '"Unknown Emoji" (400)', or just completely refusing to accept the format.
                            "skull": "💀",
                            "sob": "😭",
                            "skull_with_crossbones": "☠️", // Never seen a selfreact user use anything other than these 3, will need to just allow any emojis though.
                        };

                        const emojiName = reaction.slice(1, -1);
                        const emoji = emojiMap[emojiName.toLowerCase()] || emojiName; // for some reason discord won't let me use UNI, somehow doing this fixes it

                        // logger.info("Adding :emoji: reaction", { emojiName, emoji, messageId: message.id });

                        setTimeout(() => {
                            RestAPI.put({
                                url: `/channels/${message.channel_id}/messages/${message.id}/reactions/${encodeURIComponent(emoji)}/@me`,
                                body: {}
                            }).then(() => {
                                logger.info(":emoji: reaction added successfully", { emoji });
                            }).catch(err => {
                                logger.error("Failed to add :emoji: reaction", err);
                            });
                        }, delayAccumulator);
                        reactionAdded = true;
                        delayAccumulator += 2000;
                    } else if (!reaction.includes(":")) {
                        const emoji = reaction;
                        // logger.info("Adding emoji reaction", { emoji, messageId: message.id });

                        setTimeout(() => {
                            RestAPI.put({
                                url: `/channels/${message.channel_id}/messages/${message.id}/reactions/${encodeURIComponent(emoji)}/@me`,
                                body: {}
                            }).then(() => {
                                logger.info("Emoji reaction added successfully", { emoji });
                            }).catch(err => {
                                logger.error("Failed to add emoji reaction", err);
                            });
                        }, delayAccumulator);
                        reactionAdded = true;
                        delayAccumulator += 2000;
                    } else {
                        // logger.info("Invalid reaction format, skipping", { reaction });
                    }
                }

                if (!reactionAdded) {
                    logger.info("No valid reactions found to add", { reactions, messageContent });
                }
            }, settings.store.rateLimitDelay + Math.random() * 100); // Avoid ratelimiting the API,
        }
    },

    start() {
        logger.info("AutoReactions plugin started");
        processedMessages.clear();
    },

    stop() {
        logger.info("AutoReactions plugin stopped");
        processedMessages.clear();
    }
});
