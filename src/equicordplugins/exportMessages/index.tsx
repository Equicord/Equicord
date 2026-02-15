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
import { t } from "@utils/translation";
import definePlugin, { OptionType } from "@utils/types";
import { saveFile } from "@utils/web";
import { Message } from "@vencord/discord-types";
import { Menu, Toasts } from "@webpack/common";

import { ContactsList } from "./types";

const settings = definePluginSettings({
    openFileAfterExport: {
        type: OptionType.BOOLEAN,
        description: t("exportMessages.settings.openFileAfterExport"),
        default: true
    },
    exportContacts: {
        type: OptionType.BOOLEAN,
        description: t("exportMessages.settings.exportContacts"),
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
            title: t("exportMessages.notifications.title"),
            body: t("exportMessages.notifications.exportSuccess", { filename }),
            icon: "📄"
        });
    } catch (error) {
        showNotification({
            title: t("exportMessages.notifications.title"),
            body: t("exportMessages.notifications.exportFailed"),
            icon: "❌"
        });
    }
}

const messageContextMenuPatch = (children: Array<React.ReactElement<any> | null>, props: { message: Message; }) => {
    const { message } = props;

    if (!message) return;

    children.push(
        <Menu.MenuItem
            id="export-message"
            label={t("exportMessages.ui.exportMessage")}
            icon={() => (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                </svg>
            )}
            action={() => exportMessage(message)}
        />
    );
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
    description: t("exportMessages.description"),
    authors: [EquicordDevs.veygax, EquicordDevs.dat_insanity],
    settings,
    contextMenus: {
        "message": messageContextMenuPatch
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
            <button className="export-contacts-button" onClick={() => { this.copyContactToClipboard(); console.log("clicked"); }}>{t("exportMessages.ui.export")}</button>
        </ErrorBoundary>;
    },
    copyContactToClipboard() {
        if (this.contactList) {
            copyToClipboard(JSON.stringify(this.contactList));
            Toasts.show({
                message: t("exportMessages.ui.contactsCopied"),
                type: Toasts.Type.SUCCESS,
                id: Toasts.genId(),
                options: {
                    duration: 3000,
                    position: Toasts.Position.BOTTOM
                }
            });
            return;
        }
        Toasts.show({
            message: t("exportMessages.ui.contactListUndefined"),
            type: Toasts.Type.FAILURE,
            id: Toasts.genId(),
            options: {
                duration: 3000,
                position: Toasts.Position.BOTTOM
            }
        });
    }
});
