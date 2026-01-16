/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandOptionType, registerCommand, sendBotMessage, unregisterCommand } from "@api/Commands";
import { ApplicationCommandInputType } from "@api/Commands/types";
import { Devs, TestcordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { FluxDispatcher, UserStore } from "@webpack/common";

const CLYDE_USER_ID = "1081004946872352958";
const DISCORD_SYSTEM_USER_ID = "643945264868098049"; // Fixed Discord user ID

enum MessageType {
    DEFAULT = 0,
    RECIPIENT_ADD = 1,
    RECIPIENT_REMOVE = 2,
    CALL = 3,
    CHANNEL_NAME_CHANGE = 4,
    CHANNEL_ICON_CHANGE = 5,
    CHANNEL_PINNED_MESSAGE = 6,
    USER_JOIN = 7,
    GUILD_BOOST = 8,
    GUILD_BOOST_TIER_1 = 9,
    GUILD_BOOST_TIER_2 = 10,
    GUILD_BOOST_TIER_3 = 11,
    CHANNEL_FOLLOW_ADD = 12,
    GUILD_DISCOVERY_DISQUALIFIED = 14,
    GUILD_DISCOVERY_REQUALIFIED = 15,
    GUILD_DISCOVERY_GRACE_PERIOD_INITIAL_WARNING = 16,
    GUILD_DISCOVERY_GRACE_PERIOD_FINAL_WARNING = 17,
    THREAD_CREATED = 18,
    REPLY = 19,
    CHAT_INPUT_COMMAND = 20,
    THREAD_STARTER_MESSAGE = 21,
    GUILD_INVITE_REMINDER = 22,
    CONTEXT_MENU_COMMAND = 23,
    AUTO_MODERATION_ACTION = 24,
    ROLE_SUBSCRIPTION_PURCHASE = 25,
    INTERACTION_PREMIUM_UPSELL = 26,
    STAGE_START = 27,
    STAGE_END = 28,
    STAGE_SPEAKER = 29,
    STAGE_TOPIC = 31,
    GUILD_APPLICATION_PREMIUM_SUBSCRIPTION = 32,
    PURCHASE_NOTIFICATION = 44
}

function generateSnowflake() {
    const timestamp = Date.now() - 1420070400000;
    const random = Math.floor(Math.random() * 4096);
    const workerId = Math.floor(Math.random() * 32); // Add worker ID for uniqueness
    const processId = Math.floor(Math.random() * 32); // Add process ID for uniqueness
    return ((timestamp << 22) | (workerId << 17) | (processId << 12) | random).toString();
}

function validateInput(input: string, maxLength: number, fieldName: string): string | null {
    if (!input || input.trim().length === 0) {
        return `${fieldName} cannot be empty`;
    }
    if (input.length > maxLength) {
        return `${fieldName} cannot exceed ${maxLength} characters`;
    }
    return null;
}



function createServerBoostEmbed(boostTier: number = 1, boosterId?: string) {
    const booster = boosterId ? UserStore.getUser(boosterId) : null;
    const boosterName = booster ? `<@${booster.id}>` : "Someone";
    const levelEmoji = ["✨", "🌟", "💫"][boostTier - 1] || "✨";

    return {
        type: "rich",
        title: `${levelEmoji} Server Boosted!`,
        description: `${boosterName} just boosted the server!`,
        color: 0xFF73FA,
        thumbnail: {
            url: "https://cdn.discordapp.com/emojis/1159626882694783036.png"
        },
        fields: [
            {
                name: "Server Level",
                value: `Level ${boostTier}`,
                inline: true
            },
            {
                name: "Benefits Unlocked",
                value: `${boostTier >= 1 ? "✓ 50 Emoji Slots\n" : ""}${boostTier >= 2 ? "✓ 100 Emoji Slots\n" : ""}${boostTier >= 3 ? "✓ Animated Server Icon\n" : ""}`,
                inline: true
            }
        ],
        footer: {
            text: "Thank you for boosting!"
        },
        timestamp: new Date().toISOString()
    };
}

function createClydeEmbed(message: string) {
    return {
        type: "rich",
        description: message,
        color: 0x2F3136,
        author: {
            name: "Clyde",
            icon_url: "https://cdn.discordapp.com/embed/avatars/0.png"
        },
        timestamp: new Date().toISOString()
    };
}

function createDiscordSystemEmbed(title: string, message: string, systemType: string = "announcement") {
    const color = {
        announcement: 0x5865F2,
        warning: 0xFEE75C,
        update: 0x57F287,
        maintenance: 0xED4245
    }[systemType] || 0x5865F2;

    return {
        type: "rich",
        title: title,
        description: message,
        color: color,
        author: {
            name: "Discord",
            icon_url: "https://cdn.discordapp.com/emojis/1159627219011190824.png"
        },
        footer: {
            text: "System Message"
        },
        timestamp: new Date().toISOString()
    };
}

function createAutoModEmbed(rule: string, action: string, username?: string) {
    return {
        type: "rich",
        title: "🚨 AutoMod Action",
        description: username ? `${username} triggered an AutoMod rule` : "A message was blocked by AutoMod",
        color: 0xED4245,
        fields: [
            {
                name: "Rule Triggered",
                value: rule,
                inline: true
            },
            {
                name: "Action Taken",
                value: action,
                inline: true
            }
        ],
        footer: {
            text: "Discord AutoMod"
        },
        timestamp: new Date().toISOString()
    };
}

function createPurchaseNotificationEmbed(item: string, price: string, username?: string) {
    return {
        type: "rich",
        title: "🛒 Purchase Complete",
        description: username ? `${username} purchased ${item}` : "Thanks for your purchase!",
        color: 0x57F287,
        fields: [
            {
                name: "Item",
                value: item,
                inline: true
            },
            {
                name: "Amount",
                value: price,
                inline: true
            }
        ],
        footer: {
            text: "Discord Shop"
        },
        timestamp: new Date().toISOString()
    };
}

function dispatchFakeMessage(channelId: string, messageData: any) {
    const messageId = generateSnowflake();
    const timestamp = new Date().toISOString();

    const message = {
        id: messageId,
        type: messageData.type || MessageType.DEFAULT,
        content: messageData.content || "",
        channel_id: channelId,
        author: messageData.author,
        attachments: messageData.attachments || [],
        embeds: messageData.embeds || [],
        components: messageData.components || [],
        timestamp: timestamp,
        edited_timestamp: null,
        mentions: [],
        mention_roles: [],
        mention_everyone: false,
        pinned: false,
        webhook_id: null,
        flags: messageData.flags || 0,
        nonce: messageId,
        tts: false,
        position: 0,
        message_reference: null,
        referenced_message: null,
        interaction: null,
        activity: null,
        application: null,
        application_id: null,
        sticker_items: [],
        reactions: []
    };

    FluxDispatcher.dispatch({
        type: "MESSAGE_CREATE",
        channelId: channelId,
        message: message,
        optimistic: false,
        isPushNotification: false
    });
}



function createClydeComponents() {
    return [
        {
            type: 1,
            components: [
                {
                    type: 2,
                    style: 2,
                    label: "Dismiss message",
                    custom_id: "clyde_dismiss",
                    emoji: {
                        name: "👀",
                        id: "1159627544426946560"
                    }
                }
            ]
        }
    ];
}

export default definePlugin({
    name: "SpoofSystemV2",
    description: "Spoof official Discord system messages with realistic embeds",
    authors: [TestcordDevs.x2b],
    dependencies: ["CommandsAPI"],

    commands: [


        {
            name: "spoofboost",
            description: "Spoof a server boost notification",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    type: ApplicationCommandOptionType.USER,
                    name: "booster",
                    description: "User who boosted",
                    required: true
                },
                {
                    type: ApplicationCommandOptionType.INTEGER,
                    name: "tier",
                    description: "Boost tier (1-3)",
                    required: false,
                    choices: [
                        { name: "Tier 1", label: "Tier 1", value: "1" },
                        { name: "Tier 2", label: "Tier 2", value: "2" },
                        { name: "Tier 3", label: "Tier 3", value: "3" }
                    ]
                },
                {
                    type: ApplicationCommandOptionType.CHANNEL,
                    name: "channel",
                    description: "Channel to send in",
                    required: false
                },
                {
                    type: ApplicationCommandOptionType.BOOLEAN,
                    name: "anonymous",
                    description: "Send as anonymous boost",
                    required: false
                }
            ],
            execute: async (args, ctx) => {
                try {
                    const channelId = args.find(x => x.name === "channel")?.value ?? ctx.channel.id;
                    const boosterId = args.find(x => x.name === "booster")?.value as string;
                    const boostTier = parseInt(args.find(x => x.name === "tier")?.value as string) || 1;
                    const anonymous = args.find(x => x.name === "anonymous")?.value === "true";

                    if (!boosterId) {
                        sendBotMessage(ctx.channel.id, {
                            content: "❌ Error: Invalid booster user specified"
                        });
                        return;
                    }

                    const booster = UserStore.getUser(boosterId);
                    if (!booster) {
                        sendBotMessage(ctx.channel.id, {
                            content: "❌ Error: Booster user not found"
                        });
                        return;
                    }

                    const embed = createServerBoostEmbed(boostTier, anonymous ? undefined : boosterId);

                    dispatchFakeMessage(channelId, {
                        type: MessageType.GUILD_BOOST,
                        author: {
                            id: DISCORD_SYSTEM_USER_ID,
                            username: "Discord",
                            avatar: "f78426a064bc9dd24847519259bc42af",
                            discriminator: "0000",
                            public_flags: 1 << 17,
                            bot: false,
                            flags: 0
                        },
                        content: "",
                        embeds: [embed]
                    });

                    sendBotMessage(ctx.channel.id, {
                        content: "✅ Server boost spoofed!"
                    });
                } catch (error) {
                    console.error("Boost spoof error:", error);
                    sendBotMessage(ctx.channel.id, {
                        content: `❌ Error: ${error}`
                    });
                }
            }
        },

        {
            name: "spoofclyde",
            description: "Spoof a message from Clyde (Discord's bot)",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    type: ApplicationCommandOptionType.STRING,
                    name: "message",
                    description: "Message content from Clyde",
                    required: true
                },
                {
                    type: ApplicationCommandOptionType.CHANNEL,
                    name: "channel",
                    description: "Channel to send in",
                    required: false
                }
            ],
            execute: async (args, ctx) => {
                try {
                    const channelId = args.find(x => x.name === "channel")?.value ?? ctx.channel.id;
                    const message = args.find(x => x.name === "message")?.value as string;

                    const validationError = validateInput(message, 2000, "Message");
                    if (validationError) {
                        sendBotMessage(ctx.channel.id, {
                            content: `❌ Error: ${validationError}`
                        });
                        return;
                    }

                    const embed = createClydeEmbed(message);

                    dispatchFakeMessage(channelId, {
                        type: MessageType.DEFAULT,
                        author: {
                            id: CLYDE_USER_ID,
                            username: "Clyde",
                            avatar: null,
                            discriminator: "0000",
                            public_flags: 1 << 16,
                            bot: true,
                            flags: 0
                        },
                        content: "",
                        embeds: [embed],
                        components: createClydeComponents()
                    });

                    sendBotMessage(ctx.channel.id, {
                        content: "✅ Clyde message spoofed!"
                    });
                } catch (error) {
                    console.error("Clyde spoof error:", error);
                    sendBotMessage(ctx.channel.id, {
                        content: `❌ Error: ${error}`
                    });
                }
            }
        },

        {
            name: "spoofclydeplain",
            description: "Spoof a plain text message from Clyde (Discord's bot)",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    type: ApplicationCommandOptionType.STRING,
                    name: "message",
                    description: "Plain text message content from Clyde",
                    required: true
                },
                {
                    type: ApplicationCommandOptionType.CHANNEL,
                    name: "channel",
                    description: "Channel to send in",
                    required: false
                }
            ],
            execute: async (args, ctx) => {
                try {
                    const channelId = args.find(x => x.name === "channel")?.value ?? ctx.channel.id;
                    const message = args.find(x => x.name === "message")?.value as string;

                    const validationError = validateInput(message, 2000, "Message");
                    if (validationError) {
                        sendBotMessage(ctx.channel.id, {
                            content: `❌ Error: ${validationError}`
                        });
                        return;
                    }

                    dispatchFakeMessage(channelId, {
                        type: MessageType.DEFAULT,
                        author: {
                            id: CLYDE_USER_ID,
                            username: "Clyde",
                            avatar: null,
                            discriminator: "0000",
                            public_flags: 1 << 16,
                            bot: true,
                            flags: 0
                        },
                        content: message
                    });

                    sendBotMessage(ctx.channel.id, {
                        content: "✅ Clyde plain message spoofed!"
                    });
                } catch (error) {
                    console.error("Clyde plain spoof error:", error);
                    sendBotMessage(ctx.channel.id, {
                        content: `❌ Error: ${error}`
                    });
                }
            }
        },

        {
            name: "spoofjoin",
            description: "Spoof a user join notification",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    type: ApplicationCommandOptionType.USER,
                    name: "user",
                    description: "User who joined",
                    required: true
                },
                {
                    type: ApplicationCommandOptionType.CHANNEL,
                    name: "channel",
                    description: "Channel to send in",
                    required: false
                }
            ],
            execute: async (args, ctx) => {
                try {
                    const channelId = args.find(x => x.name === "channel")?.value ?? ctx.channel.id;
                    const userId = args.find(x => x.name === "user")?.value as string;

                    if (!userId) {
                        sendBotMessage(ctx.channel.id, {
                            content: "❌ Error: Invalid user specified"
                        });
                        return;
                    }

                    const user = UserStore.getUser(userId);
                    if (!user) {
                        sendBotMessage(ctx.channel.id, {
                            content: "❌ Error: User not found"
                        });
                        return;
                    }

                    dispatchFakeMessage(channelId, {
                        type: MessageType.USER_JOIN,
                        author: {
                            id: user.id,
                            username: user.username,
                            avatar: user.avatar,
                            discriminator: user.discriminator,
                            public_flags: user.publicFlags,
                            bot: user.bot,
                            flags: user.flags
                        },
                        content: ""
                    });

                    sendBotMessage(ctx.channel.id, {
                        content: "✅ Join notification spoofed!"
                    });
                } catch (error) {
                    console.error("Join spoof error:", error);
                    sendBotMessage(ctx.channel.id, {
                        content: `❌ Error: ${error}`
                    });
                }
            }
        },

        {
            name: "spoofpin",
            description: "Spoof a message pin notification",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    type: ApplicationCommandOptionType.USER,
                    name: "user",
                    description: "User who pinned",
                    required: true
                },
                {
                    type: ApplicationCommandOptionType.CHANNEL,
                    name: "channel",
                    description: "Channel to send in",
                    required: false
                }
            ],
            execute: async (args, ctx) => {
                try {
                    const channelId = args.find(x => x.name === "channel")?.value ?? ctx.channel.id;
                    const userId = args.find(x => x.name === "user")?.value as string;

                    if (!userId) {
                        sendBotMessage(ctx.channel.id, {
                            content: "❌ Error: Invalid user specified"
                        });
                        return;
                    }

                    const user = UserStore.getUser(userId);
                    if (!user) {
                        sendBotMessage(ctx.channel.id, {
                            content: "❌ Error: User not found"
                        });
                        return;
                    }

                    const username = `<@${user.id}>`;

                    dispatchFakeMessage(channelId, {
                        type: MessageType.CHANNEL_PINNED_MESSAGE,
                        author: {
                            id: DISCORD_SYSTEM_USER_ID,
                            username: "Discord",
                            avatar: "f78426a064bc9dd24847519259bc42af",
                            discriminator: "0000",
                            public_flags: 1 << 17,
                            bot: false,
                            flags: 0
                        },
                        content: `${username} pinned a message to this channel. See all the pins.`
                    });

                    sendBotMessage(ctx.channel.id, {
                        content: "✅ Pin notification spoofed!"
                    });
                } catch (error) {
                    console.error("Pin spoof error:", error);
                    sendBotMessage(ctx.channel.id, {
                        content: `❌ Error: ${error}`
                    });
                }
            }
        },

        {
            name: "spoofcall",
            description: "Spoof a call start/end notification",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    type: ApplicationCommandOptionType.USER,
                    name: "user",
                    description: "User who started/ended the call",
                    required: true
                },
                {
                    type: ApplicationCommandOptionType.CHANNEL,
                    name: "channel",
                    description: "Channel to send in",
                    required: false
                },
                {
                    type: ApplicationCommandOptionType.STRING,
                    name: "action",
                    description: "Call action",
                    required: true,
                    choices: [
                        { name: "Start Call", label: "Start Call", value: "start" },
                        { name: "End Call", label: "End Call", value: "end" }
                    ]
                }
            ],
            execute: async (args, ctx) => {
                try {
                    const channelId = args.find(x => x.name === "channel")?.value ?? ctx.channel.id;
                    const userId = args.find(x => x.name === "user")?.value as string;
                    const action = args.find(x => x.name === "action")?.value as string;

                    const user = UserStore.getUser(userId);
                    const username = user ? `<@${user.id}>` : "Someone";

                    const content = action === "start"
                        ? `${username} started a call.`
                        : `${username} ended the call.`;

                    dispatchFakeMessage(channelId, {
                        type: MessageType.CALL,
                        author: {
                            id: DISCORD_SYSTEM_USER_ID,
                            username: "Discord",
                            avatar: "f78426a064bc9dd24847519259bc42af",
                            discriminator: "0000",
                            public_flags: 1 << 17,
                            bot: false,
                            flags: 0
                        },
                        content: content
                    });

                    sendBotMessage(ctx.channel.id, {
                        content: "✅ Call notification spoofed!"
                    });
                } catch (error) {
                    console.error("Call spoof error:", error);
                    sendBotMessage(ctx.channel.id, {
                        content: `❌ Error: ${error}`
                    });
                }
            }
        },

        {
            name: "spoofsystem",
            description: "Spoof an official Discord system message",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    type: ApplicationCommandOptionType.STRING,
                    name: "message",
                    description: "System message content",
                    required: true
                },
                {
                    type: ApplicationCommandOptionType.CHANNEL,
                    name: "channel",
                    description: "Channel to send in",
                    required: false
                }
            ],
            execute: async (args, ctx) => {
                try {
                    const channelId = args.find(x => x.name === "channel")?.value ?? ctx.channel.id;
                    const message = args.find(x => x.name === "message")?.value as string;

                    const validationError = validateInput(message, 2000, "Message");
                    if (validationError) {
                        sendBotMessage(ctx.channel.id, {
                            content: `❌ Error: ${validationError}`
                        });
                        return;
                    }

                    dispatchFakeMessage(channelId, {
                        type: MessageType.DEFAULT,
                        author: {
                            id: DISCORD_SYSTEM_USER_ID,
                            username: "Discord",
                            avatar: "f78426a064bc9dd24847519259bc42af",
                            discriminator: "0000",
                            public_flags: 1 << 17,
                            bot: false,
                            flags: 0
                        },
                        content: message
                    });

                    sendBotMessage(ctx.channel.id, {
                        content: "✅ System message spoofed!"
                    });
                } catch (error) {
                    console.error("System spoof error:", error);
                    sendBotMessage(ctx.channel.id, {
                        content: `❌ Error: ${error}`
                    });
                }
            }
        },

        {
            name: "spoofpurchase",
            description: "Spoof a purchase notification",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    type: ApplicationCommandOptionType.USER,
                    name: "user",
                    description: "User who made purchase",
                    required: true
                },
                {
                    type: ApplicationCommandOptionType.STRING,
                    name: "item",
                    description: "Item purchased",
                    required: true
                },
                {
                    type: ApplicationCommandOptionType.STRING,
                    name: "price",
                    description: "Price (e.g., $9.99)",
                    required: true
                },
                {
                    type: ApplicationCommandOptionType.CHANNEL,
                    name: "channel",
                    description: "Channel to send in",
                    required: false
                }
            ],
            execute: async (args, ctx) => {
                try {
                    const channelId = args.find(x => x.name === "channel")?.value ?? ctx.channel.id;
                    const userId = args.find(x => x.name === "user")?.value as string;
                    const item = args.find(x => x.name === "item")?.value as string;
                    const price = args.find(x => x.name === "price")?.value as string;

                    if (!userId) {
                        sendBotMessage(ctx.channel.id, {
                            content: "❌ Error: Invalid user specified"
                        });
                        return;
                    }

                    const user = UserStore.getUser(userId);
                    if (!user) {
                        sendBotMessage(ctx.channel.id, {
                            content: "❌ Error: User not found"
                        });
                        return;
                    }

                    const embed = createPurchaseNotificationEmbed(item, price, `<@${user.id}>`);

                    dispatchFakeMessage(channelId, {
                        type: MessageType.PURCHASE_NOTIFICATION,
                        author: {
                            id: DISCORD_SYSTEM_USER_ID,
                            username: "Discord Shop",
                            avatar: "f78426a064bc9dd24847519259bc42af",
                            discriminator: "0000",
                            public_flags: 1 << 17,
                            bot: false,
                            flags: 0
                        },
                        content: "",
                        embeds: [embed]
                    });

                    sendBotMessage(ctx.channel.id, {
                        content: "✅ Purchase notification spoofed!"
                    });
                } catch (error) {
                    console.error("Purchase spoof error:", error);
                    sendBotMessage(ctx.channel.id, {
                        content: `❌ Error: ${error}`
                    });
                }
            }
        },

        {
            name: "spoofautomod",
            description: "Spoof an AutoMod action notification",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    type: ApplicationCommandOptionType.STRING,
                    name: "rule",
                    description: "AutoMod rule that was triggered",
                    required: true
                },
                {
                    type: ApplicationCommandOptionType.STRING,
                    name: "action",
                    description: "Action taken",
                    required: true,
                    choices: [
                        { name: "Block Message", label: "Block Message", value: "block" },
                        { name: "Send Alert", label: "Send Alert", value: "alert" },
                        { name: "Timeout User", label: "Timeout User", value: "timeout" }
                    ]
                },
                {
                    type: ApplicationCommandOptionType.USER,
                    name: "user",
                    description: "User who triggered it",
                    required: false
                },
                {
                    type: ApplicationCommandOptionType.CHANNEL,
                    name: "channel",
                    description: "Channel to send in",
                    required: false
                }
            ],
            execute: async (args, ctx) => {
                try {
                    const channelId = args.find(x => x.name === "channel")?.value ?? ctx.channel.id;
                    const rule = args.find(x => x.name === "rule")?.value as string;
                    const action = args.find(x => x.name === "action")?.value as string;
                    const userId = args.find(x => x.name === "user")?.value as string;

                    const ruleValidationError = validateInput(rule, 100, "Rule");
                    if (ruleValidationError) {
                        sendBotMessage(ctx.channel.id, {
                            content: `❌ Error: ${ruleValidationError}`
                        });
                        return;
                    }

                    const user = userId ? UserStore.getUser(userId) : null;
                    const actionText = {
                        block: "Message blocked",
                        alert: "Alert sent to moderators",
                        timeout: "User timed out"
                    }[action] || action;

                    const embed = createAutoModEmbed(rule, actionText, user ? `<@${user.id}>` : undefined);

                    dispatchFakeMessage(channelId, {
                        type: MessageType.AUTO_MODERATION_ACTION,
                        author: {
                            id: DISCORD_SYSTEM_USER_ID,
                            username: "Discord AutoMod",
                            avatar: "f78426a064bc9dd24847519259bc42af",
                            discriminator: "0000",
                            public_flags: 1 << 17,
                            bot: false,
                            flags: 0
                        },
                        content: "",
                        embeds: [embed]
                    });

                    sendBotMessage(ctx.channel.id, {
                        content: "✅ AutoMod notification spoofed!"
                    });
                } catch (error) {
                    console.error("AutoMod spoof error:", error);
                    sendBotMessage(ctx.channel.id, {
                        content: `❌ Error: ${error}`
                    });
                }
            }
        }
    ],

    start() {
        console.log("SpoofSystemV2 started");
        // Commands are automatically registered by the CommandsAPI
    },

    stop() {
        console.log("SpoofSystemV2 stopped");
        // Commands are automatically unregistered by the CommandsAPI
    }
});





