/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { CopyIcon } from "@components/Icons";
import { EquicordDevs } from "@utils/constants";
import { copyWithToast } from "@utils/discord";
import definePlugin, { OptionType } from "@utils/types";
import { Channel, Message } from "@vencord/discord-types";
import { ChannelStore, Menu } from "@webpack/common";

const settings = definePluginSettings({
    customFormat: {
        type: OptionType.STRING,
        description: "For Custom Format. Placeholders(Variables): {user}, {author}, {message}, {time}, {date}, {channel}, {link}, {id}",
        default: "{user}: {message}"
    },
    customFormatName: {
        type: OptionType.STRING,
        description: "Name for the custom format option in the context menu",
        default: "Custom Format"
    },
    showCustomFormat: {
        type: OptionType.BOOLEAN,
        description: "Show Custom Format",
        default: false
    },
    showQuote: {
        type: OptionType.BOOLEAN,
        description: "Show Markdown Quote",
        default: true
    },
    showBlockquote: {
        type: OptionType.BOOLEAN,
        description: "Show Blockquote",
        default: true
    },
    showTimestamp: {
        type: OptionType.BOOLEAN,
        description: "Show Timestamped Quote",
        default: true
    },
    showSentBy: {
        type: OptionType.BOOLEAN,
        description: "Show Sent By Quote",
        default: true
    },
    showModEvidence: {
        type: OptionType.BOOLEAN,
        description: "Show Mod Evidence / Log",
        default: true
    },
    showCodeblock: {
        type: OptionType.BOOLEAN,
        description: "Show Code Block",
        default: true
    },
    showCleanText: {
        type: OptionType.BOOLEAN,
        description: "Show Clean Text",
        default: true
    },
    showLinkAndText: {
        type: OptionType.BOOLEAN,
        description: "Show Text + Link",
        default: true
    },
    showEmbed: {
        type: OptionType.BOOLEAN,
        description: "Show Copy Embed",
        default: true
    }
});

function stripMarkdown(text: string): string {
    return text
        .replace(/```(?:[a-zA-Z0-9_-]+)?\n?([\s\S]*?)```/g, "$1")
        .replace(/`([^`\n]+)`/g, "$1")
        .replace(/\|\|([\s\S]*?)\|\|/g, "$1")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/^>+\s?/gm, "")
        .replace(/^#{1,3}\s+/gm, "")
        .replace(/^-#\s+/gm, "")
        .replace(/^(\s*)[-*]\s+/gm, "$1")
        .replace(/^(\s*)\d+\.\s+/gm, "$1")
        .replace(/~~([^~]+)~~/g, "$1")
        .replace(/\*{3}(.*?)\*{3}/g, "$1")
        .replace(/_{3}(.*?)_{3}/g, "$1")
        .replace(/\*{2}(.*?)\*{2}/g, "$1")
        .replace(/_{2}(.*?)_{2}/g, "$1")
        .replace(/\*([^*\n]+)\*/g, "$1")
        .replace(/_([^_\n]+)_/g, "$1")
        .replace(/<a?:([a-zA-Z0-9_]+):\d+>/g, ":$1:")
        .replace(/[\u200B-\u200D\u200E\u200F\uFEFF]/g, "")
        .trim();
}

function hasEmbedPayload(message: Message): boolean {
    const isBot = Boolean(message.author?.bot || message.webhookId);
    const hasRichEmbed = message.embeds?.some(e => e.type === "rich");
    return (isBot && Boolean(message.embeds?.length)) || Boolean(hasRichEmbed);
}

function formatMessage(template: string, message: Message, channel?: Channel): string {
    const { author } = message;
    const authorName = author?.globalName || author?.username || "Unknown";
    const username = author?.username || "Unknown";
    const content = message.content || "";

    const resolvedChannel = channel ?? ChannelStore.getChannel(message.channel_id);
    const timestamp = new Date(message.timestamp ?? Date.now());
    const timeStr = timestamp.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const dateStr = timestamp.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
    const channelName = resolvedChannel?.name ? `#${resolvedChannel.name}` : "DM";
    const guildId = resolvedChannel?.guild_id || "@me";
    const link = `https://discord.com/channels/${guildId}/${message.channel_id}/${message.id}`;

    return template
        .replace(/\{user\}/gi, () => `@${username}`)
        .replace(/\{author\}/gi, () => authorName)
        .replace(/\{message\}/gi, () => content)
        .replace(/\{time\}/gi, () => timeStr)
        .replace(/\{date\}/gi, () => dateStr)
        .replace(/\{channel\}/gi, () => channelName)
        .replace(/\{link\}/gi, () => link)
        .replace(/\{id\}/gi, () => message.id);
}

function getEmbedPayload(message: Message): string {
    const payload: Record<string, any> = {};
    if (message.content) payload.content = message.content;
    if (message.embeds?.length) payload.embeds = message.embeds;
    if (message.components?.length) payload.components = message.components;

    return JSON.stringify(payload, null, 2);
}

const MessageContextMenuPatch: NavContextMenuPatchCallback = (children, { message, channel }: { message?: Message; channel?: Channel; }) => {
    if (!message) return;

    const { author } = message;
    const authorName = author?.globalName || author?.username || "Unknown";
    const authorId = author?.id || "Unknown";
    const content = message.content || "";
    const items: React.ReactElement[] = [];

    const resolvedChannel = channel ?? ChannelStore.getChannel(message.channel_id);
    const timestamp = new Date(message.timestamp ?? Date.now());
    const timeStr = timestamp.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const channelName = resolvedChannel?.name ? `#${resolvedChannel.name}` : "DM";
    const guildId = resolvedChannel?.guild_id || "@me";
    const link = `https://discord.com/channels/${guildId}/${message.channel_id}/${message.id}`;
    const unixTime = Math.floor(timestamp.getTime() / 1000);

    if (settings.store.showCustomFormat && settings.store.customFormat?.trim() && content) {
        items.push(
            <Menu.MenuItem
                id="copy-custom"
                label={settings.store.customFormatName?.trim() || "Custom Format"}
                action={() => copyWithToast(formatMessage(settings.store.customFormat, message, resolvedChannel))}
            />
        );
    }

    if (content) {
        if (settings.store.showQuote) {
            items.push(
                <Menu.MenuItem
                    id="copy-quote"
                    label="Markdown Quote"
                    action={() => copyWithToast(`> **${authorName}**: ${content.replace(/\n/g, "\n> ")}`)}
                />
            );
        }
        if (settings.store.showBlockquote) {
            items.push(
                <Menu.MenuItem
                    id="copy-blockquote"
                    label="Blockquote"
                    action={() => copyWithToast(`>>> **${authorName}**:\n${content}`)}
                />
            );
        }
        if (settings.store.showTimestamp) {
            items.push(
                <Menu.MenuItem
                    id="copy-timestamp"
                    label="Timestamped Quote"
                    action={() => copyWithToast(`[${timeStr}] ${authorName}: ${content}`)}
                />
            );
        }
        if (settings.store.showSentBy) {
            items.push(
                <Menu.MenuItem
                    id="copy-sent-by"
                    label="Sent By Quote"
                    action={() => copyWithToast(`Sent by ${authorName} at ${timeStr} in ${channelName}:\n> ${content.replace(/\n/g, "\n> ")}`)}
                />
            );
        }
        if (settings.store.showModEvidence) {
            items.push(
                <Menu.MenuItem
                    id="copy-mod-evidence"
                    label="Mod Evidence / Log"
                    action={() => copyWithToast(`**Sent by:** ${authorName} (\`${authorId}\`)\n**Channel:** ${channelName} (<#${message.channel_id}>)\n**Time:** <t:${unixTime}:f> (<t:${unixTime}:R>)\n**Message Link:** ${link}\n**Content:**\n> ${content.replace(/\n/g, "\n> ")}`)}
                />
            );
        }

        if (settings.store.showCodeblock) {
            items.push(
                <Menu.MenuItem
                    id="copy-codeblock"
                    label="Code Block"
                    action={() => copyWithToast(`\`\`\`\n${content}\n\`\`\``)}
                />
            );
        }
        if (settings.store.showCleanText) {
            items.push(
                <Menu.MenuItem
                    id="copy-clean"
                    label="Clean Text"
                    action={() => copyWithToast(stripMarkdown(content))}
                />
            );
        }
        if (settings.store.showLinkAndText) {
            items.push(
                <Menu.MenuItem
                    id="copy-link-text"
                    label="Text + Link"
                    action={() => copyWithToast(`${content}\n${link}`)}
                />
            );
        }
    }

    if (settings.store.showEmbed && hasEmbedPayload(message)) {
        items.push(
            <Menu.MenuItem
                id="copy-embed"
                label="Copy Embed"
                action={() => copyWithToast(getEmbedPayload(message))}
            />
        );
    }

    if (!items.length) return;

    children.push(
        <Menu.MenuSeparator />,
        <Menu.MenuItem
            id="vc-copy-formatted"
            label="Copy As"
            icon={CopyIcon}
            leadingAccessory={{ type: "icon", icon: CopyIcon }}
        >
            {items}
        </Menu.MenuItem>
    );
};

export default definePlugin({
    name: "CopyFormat",
    description: "Adds a 'Copy As' option to the message context menu.",
    authors: [EquicordDevs.snea1337],
    dependencies: ["MessagePopoverAPI"],
    tags: ["Utility", "Chat"],
    settings,
    contextMenus: {
        "message": MessageContextMenuPatch
    },
    messagePopoverButton: {
        icon: CopyIcon,
        render(msg) {
            if (!settings.store.showEmbed || !hasEmbedPayload(msg)) return null;

            return {
                label: "Copy Embed",
                icon: CopyIcon,
                message: msg,
                channel: ChannelStore.getChannel(msg.channel_id),
                onClick: () => copyWithToast(getEmbedPayload(msg))
            };
        }
    }
});
