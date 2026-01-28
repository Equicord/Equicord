/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { showNotification } from "@api/Notifications";
import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { copyToClipboard } from "@utils/clipboard";
import { EquicordDevs } from "@utils/constants";
import { showItemInFolder } from "@utils/native";
import definePlugin, { OptionType } from "@utils/types";
import { saveFile } from "@utils/web";
import { Channel, Message } from "@vencord/discord-types";
import { Menu, RestAPI, Constants, Toasts } from "@webpack/common";
import { sleep } from "@utils/misc";

import { ContactsList } from "./types";

const settings = definePluginSettings({
    openFileAfterExport: {
        type: OptionType.BOOLEAN,
        description: "Open the exported file in the default file handler after export",
        default: true
    },
    exportContacts: {
        type: OptionType.BOOLEAN,
        description: "Export a list of friends to your clipboard. Adds a new button to the menu bar for the friends tab.",
        default: false
    }
});

function formatMessage(message: Message) {
    const { author } = message;
    const timestamp = new Date(message.timestamp.toString()).toLocaleString();

    let content = `[${timestamp}] ${author.username}`;
    if (author.discriminator !== "0") {
        content += `#${author.discriminator}`;
    }
    content += `: ${message.content}`;

    if (message.attachments?.length > 0) {
        content += "\n  Attachments:";
        message.attachments.forEach(attachment => {
            content += `\n    - ${attachment.filename} (${attachment.url})`;
        });
    }

    if (message.embeds?.length > 0) {
        content += "\n  Embeds:";
        message.embeds.forEach(embed => {
            if (embed.rawTitle) content += `\n    Title: ${embed.rawTitle}`;
            if (embed.rawDescription) content += `\n    Description: ${embed.rawDescription}`;
            if (embed.url) content += `\n    URL: ${embed.url}`;
        });
    }

    return content;
}

function normalizeRawMessage(raw: any) {
    const author = raw.author || {};
    const attachments = (raw.attachments || []).map((a: any) => ({ filename: a.filename, url: a.url || a.proxy_url }));
    const embeds = (raw.embeds || []).map((e: any) => ({ rawTitle: e.title ?? e.rawTitle, rawDescription: e.description ?? e.rawDescription, url: e.url }));

    return {
        id: raw.id,
        timestamp: raw.timestamp,
        content: raw.content ?? "",
        author: {
            username: author.username ?? "Unknown",
            discriminator: author.discriminator ?? "0"
        },
        attachments,
        embeds
    } as unknown as Message;
}

async function exportMessage(message: Message) {
    const timestamp = new Date(message.timestamp.toString()).toISOString().split("T")[0];
    const filename = `message-${message.id}-${timestamp}.txt`;

    const content = formatMessage(message);

    try {
        if (IS_DISCORD_DESKTOP) {
            const data = new TextEncoder().encode(content);
            const result = await DiscordNative.fileManager.saveWithDialog(data, filename);

            if (result && settings.store.openFileAfterExport) {
                showItemInFolder(result);
            }
        } else {
            const file = new File([content], filename, { type: "text/plain" });
            saveFile(file);
        }

        showNotification({
            title: "Export Messages",
            body: `Message exported successfully as ${filename}`,
            icon: "📄"
        });
    } catch (error) {
        showNotification({
            title: "Export Messages",
            body: "Failed to export message",
            icon: "❌"
        });
    }
}

async function exportChannel(channel: Channel) {
    const channelName = (channel.name || "direct-messages").replace(/\s+/gi, '-').replace(/[^a-zA-Z0-9\-]/gi, '');
    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `channel-${channelName}-${timestamp}.txt`;

    showNotification({
        title: "Exporting Messages...",
        body: `Exporting channel as ${filename}. This may take a while on large channels...`,
        icon: "⏳"
    });

    try {
        const pageLimit = 100;
        let allMessages: Message[] = [];
        let before: string | undefined = undefined;

        while (true) {
            const res = await RestAPI.get({
                url: Constants.Endpoints.MESSAGES(channel.id),
                query: {
                    limit: pageLimit,
                    before
                },
                retries: 2
            }).catch((err) => {
                return console.error("Failed to fetch messages:", err);
            });

            const pageRaw: any[] = res?.body ?? [];

            if (!pageRaw || pageRaw.length === 0) break;

            const page = pageRaw.map(normalizeRawMessage);
            allMessages = allMessages.concat(page);

            if (pageRaw.length < pageLimit) break;

            before = pageRaw[pageRaw.length - 1]?.id;

            // small delay to avoid rate limits
            await sleep(250);
        }

        const content = allMessages
            .slice()
            .reverse()
            .map(msg => formatMessage(msg))
            .join("\n");

        if (!content.trim()) {
            showNotification({
                title: "Export Messages",
                body: "No messages to export from this channel",
                icon: "ℹ️"
            });
            return;
        }

        if (IS_DISCORD_DESKTOP) {
            const data = new TextEncoder().encode(content);
            const result = await DiscordNative.fileManager.saveWithDialog(data, filename);

            if (result && settings.store.openFileAfterExport) {
                showItemInFolder(result);
            }
        } else {
            const file = new File([content], filename, { type: "text/plain" });
            saveFile(file);
        }

        showNotification({
            title: "Export Messages",
            body: `Channel exported successfully as ${filename} (${allMessages.length} messages)`,
            icon: "📄"
        });
    } catch (error) {
        console.error("Channel export error:", error);
        showNotification({
            title: "Export Messages",
            body: "Failed to export channel",
            icon: "❌"
        });
    }
}

const exportContextMenuPatch = (children: Array<React.ReactElement<any> | null>, props: any) => {
    const { message, channel } = props;

    if (message) {
        children.push(
            <Menu.MenuItem
                id="export-message"
                label="Export Message"
                icon={() => (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                    </svg>
                )}
                action={() => exportMessage(message)}
            />
        );
    }
    else if (channel) {
        children.push(
            <Menu.MenuItem
                id="export-channel"
                label="Export Channel"
                icon={() => (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                    </svg>
                )}
                action={() => exportChannel(channel)}
            />
        );
    }
};

// for type parameter, it takes in a number that determines the type of the contact
// 1 is friends added
// 2 is blocked users
// 3 is incoming friend requests
// 4 is outgoing friend requests
function getUsernames(contacts: ContactsList[], type: number): string[] {
    return contacts
        // only select contacts that are the specified type
        .filter(e => e.type === type)
        // return the username, and discriminator if necessary
        .map(e => e.user.discriminator === "0" ? e.user.username : e.user.username + "#" + e.user.discriminator);
}

export default definePlugin({
    name: "ExportMessages",
    description: "Allows you to export any message or entire channel to a file",
    authors: [EquicordDevs.veygax, EquicordDevs.dat_insanity, EquicordDevs.ASOwnerYT],
    settings,
    contextMenus: {
        "message": exportContextMenuPatch,
        "channel-context": exportContextMenuPatch,
        "gdm-context": exportContextMenuPatch
    },
    patches: [
        {
            find: "fetchRelationships(){",
            replacement: {
                match: /(\.then\(\i)=>(\i\.\i\.dispatch\({type:"LOAD_RELATIONSHIPS_SUCCESS",relationships:(\i\.body)}\))/,
                replace: "$1=>{$2; $self.getContacts($3)}"
            }
        },
        {
            find: "[role=\"tab\"][aria-disabled=\"false\"]",
            replacement: {
                match: /("aria-label":(\i).{0,25})(\i)\.Children\.map\((\i),this\.renderChildren\)/,
                replace:
                    "$1($3 && $3.Children" +
                    "? ($2 === 'Friends'" +
                    "? [...$3.Children.map($4, this.renderChildren), $self.addExportButton()]" +
                    ": [...$3.Children.map($4, this.renderChildren)])" +
                    ": $3.map($4, this.renderChildren))"
            }
        }
    ],
    getContacts(contacts: ContactsList[]) {
        this.contactList = {
            friendsAdded: [...getUsernames(contacts, 1)],
            blockedUsers: [...getUsernames(contacts, 2)],
            incomingFriendRequests: [...getUsernames(contacts, 3)],
            outgoingFriendRequests: [...getUsernames(contacts, 4)]
        };
    },
    addExportButton() {
        return <ErrorBoundary noop key=".2">
            <button className="export-contacts-button" onClick={() => { this.copyContactToClipboard(); console.log("clicked"); }}>Export</button>
        </ErrorBoundary>;
    },
    copyContactToClipboard() {
        if (this.contactList) {
            copyToClipboard(JSON.stringify(this.contactList));
            Toasts.show({
                message: "Contacts copied to clipboard successfully.",
                type: Toasts.Type.SUCCESS,
                id: Toasts.genId(),
                options: {
                    duration: 3000,
                    position: Toasts.Position.BOTTOM
                }
            });
            return;
        }
        // reason why you need to click the all tab is because the data is extracted during
        // the request itself when you fetch all your friends. this is done to avoid sending a
        // manual request to discord, which may raise suspicion and might even get you terminated.
        Toasts.show({
            message: "Contact list is undefined. Click on the \"All\" tab before exporting.",
            type: Toasts.Type.FAILURE,
            id: Toasts.genId(),
            options: {
                duration: 3000,
                position: Toasts.Position.BOTTOM
            }
        });
    }
});
