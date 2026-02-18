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

import { ApplicationCommandInputType, ApplicationCommandOptionType, findOption, registerCommand, sendBotMessage, unregisterCommand } from "@api/Commands";
import { definePluginSettings } from "@api/Settings";
import { Devs, EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";

const EMOTE = "<:luna:1035316192220553236>";
const DATA_KEY = "MessageTags_TAGS";
const MessageTagsMarker = Symbol("MessageTags");

interface Tag {
    name: string;
    message: string;
    modified: boolean;
}

function getTags() {
    return settings.store.tagsList;
}

function getTag(name: string) {
    return settings.store.tagsList[name] ?? null;
}

function getTagEntries() {
    return Object.values(getTags()).sort((a, b) => a.name.localeCompare(b.name));
}

function normalizeTagMessageInput(input: string) {
    return input.replaceAll("\r\n", "\n").replaceAll("\\n", "\n");
}

function resolveTag(nameOrIndex: string) {
    const direct = getTag(nameOrIndex);
    if (direct) return direct;

    const lowered = nameOrIndex.toLowerCase();
    const byName = getTagEntries().find(tag => tag.name.toLowerCase() === lowered);
    if (byName) return byName;

    const parsed = Number(nameOrIndex);
    if (!Number.isInteger(parsed) || parsed <= 0) return null;
    return getTagEntries()[parsed - 1] ?? null;
}

function migrateTags() {
    const next: Record<string, Tag> = {};

    for (const [name, raw] of Object.entries(settings.store.tagsList)) {
        const tag = raw as Partial<Tag>;
        next[name] = {
            name,
            message: normalizeTagMessageInput(String(tag.message ?? "")),
            modified: Boolean(tag.modified)
        };
    }

    settings.store.tagsList = next;
}

function addTag(tag: Tag) {
    settings.store.tagsList[tag.name] = tag;
}

function removeTag(name: string) {
    delete settings.store.tagsList[name];
}

function createTagCommand(tag: Tag) {
    registerCommand({
        name: tag.name,
        description: tag.name,
        inputType: ApplicationCommandInputType.BUILT_IN_TEXT,
        execute: async (_, ctx) => {
            if (!getTag(tag.name)) {
                sendBotMessage(ctx.channel.id, {
                    content: `${EMOTE} The tag **${tag.name}** does not exist anymore! Please reload ur Discord to fix :)`
                });
                return { content: `/${tag.name}` };
            }

            if (settings.store.clyde) sendBotMessage(ctx.channel.id, {
                content: `${EMOTE} The tag **${tag.name}** has been sent!`
            });
            return { content: tag.message };
        },
        [MessageTagsMarker]: true,
    }, "CustomTags");
}

const settings = definePluginSettings({
    clyde: {
        name: "Clyde message on send",
        description: "If enabled, clyde will send you an ephemeral message when a tag was used.",
        type: OptionType.BOOLEAN,
        default: true
    },
    tagsList: {
        type: OptionType.CUSTOM,
        default: {} as Record<string, Tag>,
        description: ""
    }
});

export default definePlugin({
    name: "MessageTags",
    description: "Allows you to save messages and to use them with a simple command.",
    authors: [Devs.Luna, EquicordDevs.omaw],
    settings,

    async start() {
        migrateTags();
        const tags = getTags();
        for (const tagName in tags) {
            createTagCommand(tags[tagName]);
        }
    },

    commands: [
        {
            name: "tags",
            description: "Manage all the tags for yourself",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    name: "create",
                    description: "Create a new tag",
                    type: ApplicationCommandOptionType.SUB_COMMAND,
                    options: [
                        {
                            name: "tag-name",
                            description: "The name of the tag to trigger the response",
                            type: ApplicationCommandOptionType.STRING,
                            required: true
                        },
                        {
                            name: "message",
                            description: "The message that you will send when using this tag",
                            type: ApplicationCommandOptionType.STRING,
                            required: true
                        }
                    ]
                },
                {
                    name: "list",
                    description: "List all tags from yourself",
                    type: ApplicationCommandOptionType.SUB_COMMAND,
                    options: []
                },
                {
                    name: "send",
                    description: "Send a tag by name or index from /tags list",
                    type: ApplicationCommandOptionType.SUB_COMMAND,
                    options: [
                        {
                            name: "tag",
                            description: "Tag name or numeric index from /tags list",
                            type: ApplicationCommandOptionType.STRING,
                            required: true
                        }
                    ]
                },
                {
                    name: "delete",
                    description: "Remove a tag from your yourself",
                    type: ApplicationCommandOptionType.SUB_COMMAND,
                    options: [
                        {
                            name: "tag-name",
                            description: "The name of the tag to trigger the response",
                            type: ApplicationCommandOptionType.STRING,
                            required: true
                        }
                    ]
                },
                {
                    name: "update",
                    description: "Update an existing tag and mark it as modified",
                    type: ApplicationCommandOptionType.SUB_COMMAND,
                    options: [
                        {
                            name: "tag-name",
                            description: "The name of the tag to update",
                            type: ApplicationCommandOptionType.STRING,
                            required: true
                        },
                        {
                            name: "message",
                            description: "The new message for this tag",
                            type: ApplicationCommandOptionType.STRING,
                            required: true
                        }
                    ]
                },
                {
                    name: "preview",
                    description: "Preview a tag without sending it publicly",
                    type: ApplicationCommandOptionType.SUB_COMMAND,
                    options: [
                        {
                            name: "tag-name",
                            description: "The name of the tag to trigger the response",
                            type: ApplicationCommandOptionType.STRING,
                            required: true
                        }
                    ]
                }
            ],

            async execute(args, ctx) {

                switch (args[0].name) {
                    case "create": {
                        const name: string = findOption(args[0].options, "tag-name", "");
                        const message: string = normalizeTagMessageInput(findOption(args[0].options, "message", ""));

                        if (getTag(name))
                            return sendBotMessage(ctx.channel.id, {
                                content: `${EMOTE} A Tag with the name **${name}** already exists!`
                            });

                        const tag = {
                            name: name,
                            message: message,
                            modified: false
                        };

                        createTagCommand(tag);
                        addTag(tag);

                        sendBotMessage(ctx.channel.id, {
                            content: `${EMOTE} Successfully created the tag **${name}**!`
                        });
                        break; // end 'create'
                    }
                    case "send": {
                        const key: string = findOption(args[0].options, "tag", "");
                        const tag = resolveTag(key);

                        if (!tag)
                            return sendBotMessage(ctx.channel.id, {
                                content: `${EMOTE} No tag found for **${key}**. Use \`/tags list\`.`
                            });

                        if (settings.store.clyde) sendBotMessage(ctx.channel.id, {
                            content: `${EMOTE} The tag **${tag.name}** has been sent!`
                        });

                        return { content: tag.message };
                    }
                    case "delete": {
                        const name: string = findOption(args[0].options, "tag-name", "");

                        if (!getTag(name))
                            return sendBotMessage(ctx.channel.id, {
                                content: `${EMOTE} A Tag with the name **${name}** does not exist!`
                            });

                        unregisterCommand(name);
                        removeTag(name);

                        sendBotMessage(ctx.channel.id, {
                            content: `${EMOTE} Successfully deleted the tag **${name}**!`
                        });
                        break; // end 'delete'
                    }
                    case "update": {
                        const name: string = findOption(args[0].options, "tag-name", "");
                        const message: string = normalizeTagMessageInput(findOption(args[0].options, "message", ""));
                        const existing = getTag(name);

                        if (!existing)
                            return sendBotMessage(ctx.channel.id, {
                                content: `${EMOTE} A Tag with the name **${name}** does not exist!`
                            });

                        addTag({
                            name,
                            message,
                            modified: true
                        });

                        sendBotMessage(ctx.channel.id, {
                            content: `${EMOTE} Successfully updated the tag **${name}**!`
                        });
                        break;
                    }
                    case "list": {
                        const tagList = getTagEntries();
                        sendBotMessage(ctx.channel.id, {
                            embeds: [
                                {
                                    title: "All Tags:",
                                    description: tagList
                                        .map((tag, index) => {
                                            const preview = tag.message.replaceAll("\n", " ").slice(0, 72);
                                            const suffix = tag.message.length > 72 ? "..." : "";
                                            const modified = tag.modified ? " (modified)" : "";
                                            return `\`${index + 1}.\` **${tag.name}**${modified}: ${preview}${suffix}`;
                                        })
                                        .join("\n") || `${EMOTE} Woops! There are no tags yet, use \`/tags create\` to create one!`,
                                    // @ts-expect-error
                                    color: 0xd77f7f,
                                    type: "rich",
                                }
                            ]
                        });
                        break; // end 'list'
                    }
                    case "preview": {
                        const name: string = findOption(args[0].options, "tag-name", "");
                        const tag = resolveTag(name);

                        if (!tag)
                            return sendBotMessage(ctx.channel.id, {
                                content: `${EMOTE} A Tag with the name **${name}** does not exist!`
                            });

                        sendBotMessage(ctx.channel.id, {
                            content: tag.message
                        });
                        break; // end 'preview'
                    }

                    default: {
                        sendBotMessage(ctx.channel.id, {
                            content: "Invalid sub-command"
                        });
                        break;
                    }
                }
            }
        }
    ]
});
