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

import { isPluginEnabled } from "@api/PluginManager";
import { definePluginSettings } from "@api/Settings";
import NoReplyMentionPlugin from "@plugins/noReplyMention";
import { Devs, EquicordDevs } from "@utils/constants";
import { copyWithToast } from "@utils/discord";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { ApplicationIntegrationType, MessageFlags } from "@vencord/discord-types/enums";
import { findByPropsLazy } from "@webpack";
import { AuthenticationStore, Constants, FluxDispatcher, MessageTypeSets, PermissionsBits, PermissionStore, RestAPI, Toasts, WindowStore } from "@webpack/common";

const MessageActions = findByPropsLazy("deleteMessage", "startEditMessage");
const EditStore = findByPropsLazy("isEditing", "isEditingAny");

let isDeletePressed = false;
const keydown = (e: KeyboardEvent) => e.key === "Backspace" && (isDeletePressed = true);
const keyup = (e: KeyboardEvent) => e.key === "Backspace" && (isDeletePressed = false);
const focusChanged = () => !WindowStore.isFocused() && (isDeletePressed = false);

let doubleClickTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingDoubleClickAction: (() => void) | null = null;

enum ClickAction {
    NONE = "none",
    DELETE = "delete",
    EDIT = "edit",
    REPLY = "reply",
    COPY_CONTENT = "copy_content",
    COPY_LINK = "copy_link",
    REACT = "react",
    PIN = "pin"
}

const settings = definePluginSettings({
    backspaceClickAction: {
        type: OptionType.SELECT,
        description: "Action when holding Backspace and clicking a message",
        options: [
            { label: "Delete Message", value: ClickAction.DELETE, default: true },
            { label: "Copy Content", value: ClickAction.COPY_CONTENT },
            { label: "Copy Link", value: ClickAction.COPY_LINK },
            { label: "None (Disabled)", value: ClickAction.NONE }
        ]
    },
    doubleClickAction: {
        type: OptionType.SELECT,
        description: "Action on double-click (on your messages)",
        options: [
            { label: "Edit Message", value: ClickAction.EDIT, default: true },
            { label: "Copy Content", value: ClickAction.COPY_CONTENT },
            { label: "Copy Link", value: ClickAction.COPY_LINK },
            { label: "None (Disabled)", value: ClickAction.NONE }
        ]
    },
    doubleClickOthersAction: {
        type: OptionType.SELECT,
        description: "Action on double-click (on others' messages)",
        options: [
            { label: "Reply", value: ClickAction.REPLY, default: true },
            { label: "Copy Content", value: ClickAction.COPY_CONTENT },
            { label: "Copy Link", value: ClickAction.COPY_LINK },
            { label: "React", value: ClickAction.REACT },
            { label: "Pin Message", value: ClickAction.PIN },
            { label: "None (Disabled)", value: ClickAction.NONE }
        ]
    },
    tripleClickAction: {
        type: OptionType.SELECT,
        description: "Action on triple-click",
        options: [
            { label: "React", value: ClickAction.REACT, default: true },
            { label: "Copy Content", value: ClickAction.COPY_CONTENT },
            { label: "Copy Link", value: ClickAction.COPY_LINK },
            { label: "Pin Message", value: ClickAction.PIN },
            { label: "None (Disabled)", value: ClickAction.NONE }
        ]
    },
    reactEmoji: {
        type: OptionType.STRING,
        description: "Emoji to use for react actions (e.g. 💀 or pepe:123456789)",
        default: "💀"
    },
    requireModifier: {
        type: OptionType.BOOLEAN,
        description: "Only perform click actions when shift or ctrl is held",
        default: false
    },
    disableInDMs: {
        type: OptionType.BOOLEAN,
        description: "Disable all click actions in direct messages",
        default: false
    }
});

function showPermissionWarning(action: string) {
    Toasts.show({
        message: `Cannot ${action}: Missing permissions`,
        type: Toasts.Type.FAILURE,
        id: `message-click-actions-${action}`,
        options: {
            duration: 3000
        }
    });
}

async function react(channelId: string, messageId: string, emoji: string, channel: any) {
    const trimmed = emoji.trim();
    if (!trimmed) return;

    if (!PermissionStore.can(PermissionsBits.ADD_REACTIONS, channel) && !PermissionStore.can(PermissionsBits.READ_MESSAGE_HISTORY, channel)) {
        showPermissionWarning("add reaction");
        return;
    }

    const customMatch = trimmed.match(/^:?([\w-]+):(\d+)$/);
    const emojiParam = customMatch
        ? `${customMatch[1]}:${customMatch[2]}`
        : trimmed;

    try {
        await RestAPI.put({
            url: Constants.Endpoints.REACTION(channelId, messageId, emojiParam, "@me")
        });
    } catch (e) {
        new Logger("MessageClickActions").error("Failed to add reaction:", e);
    }
}

export default definePlugin({
    name: "MessageClickActions",
    description: "Customize message click actions - choose what happens when you click, double-click, or hold backspace",
    authors: [Devs.Ven, EquicordDevs.keyages],

    settings,

    start() {
        document.addEventListener("keydown", keydown);
        document.addEventListener("keyup", keyup);
        WindowStore.addChangeListener(focusChanged);
    },

    stop() {
        document.removeEventListener("keydown", keydown);
        document.removeEventListener("keyup", keyup);
        WindowStore.removeChangeListener(focusChanged);

        if (doubleClickTimeout) {
            clearTimeout(doubleClickTimeout);
            doubleClickTimeout = null;
        }
        pendingDoubleClickAction = null;
    },

    onMessageClick(msg, channel, event) {
        const myId = AuthenticationStore.getId();
        const isMe = msg.author.id === myId;
        const isSelfInvokedUserApp = msg.interactionMetadata?.authorizing_integration_owners[ApplicationIntegrationType.USER_INSTALL] === myId;
        const isDM = !channel.guild_id;
        const isSystemMessage = !MessageTypeSets.USER_MESSAGE.has(msg.type);

        if (settings.store.disableInDMs && isDM) return;
        if (isSystemMessage) return;

        if (isDeletePressed) {
            const action = settings.store.backspaceClickAction;
            if (action === ClickAction.NONE) return;

            if (action === ClickAction.DELETE) {
                if (!(isMe || PermissionStore.can(PermissionsBits.MANAGE_MESSAGES, channel) || isSelfInvokedUserApp)) {
                    showPermissionWarning("delete message");
                    return;
                }

                if (msg.deleted) {
                    FluxDispatcher.dispatch({
                        type: "MESSAGE_DELETE",
                        channelId: channel.id,
                        id: msg.id,
                        mlDeleted: true
                    });
                } else {
                    MessageActions.deleteMessage(channel.id, msg.id);
                }
            } else if (action === ClickAction.COPY_CONTENT) {
                copyWithToast(msg.content || "", "Message content copied!");
            } else if (action === ClickAction.COPY_LINK) {
                const link = `https://discord.com/channels/${channel.guild_id ?? "@me"}/${channel.id}/${msg.id}`;
                copyWithToast(link, "Message link copied!");
            }
            event.preventDefault();
            return;
        }

        if (event.detail === 3) {
            if (doubleClickTimeout) {
                clearTimeout(doubleClickTimeout);
                doubleClickTimeout = null;
                pendingDoubleClickAction = null;
            }

            const action = settings.store.tripleClickAction;
            if (action === ClickAction.NONE) return;

            if (action === ClickAction.REACT) {
                if (!PermissionStore.can(PermissionsBits.ADD_REACTIONS, channel) && !PermissionStore.can(PermissionsBits.READ_MESSAGE_HISTORY, channel)) {
                    showPermissionWarning("add reaction");
                    return;
                }
                react(channel.id, msg.id, settings.store.reactEmoji, channel);
            } else if (action === ClickAction.COPY_CONTENT) {
                copyWithToast(msg.content || "", "Message content copied!");
            } else if (action === ClickAction.COPY_LINK) {
                const link = `https://discord.com/channels/${channel.guild_id ?? "@me"}/${channel.id}/${msg.id}`;
                copyWithToast(link, "Message link copied!");
            } else if (action === ClickAction.PIN) {
                if (!PermissionStore.can(PermissionsBits.MANAGE_MESSAGES, channel)) {
                    showPermissionWarning("pin message");
                    return;
                }
                MessageActions.pinMessage(channel.id, msg.id);
            }
            event.preventDefault();
            return;
        }

        if (event.detail !== 2) return;
        if (settings.store.requireModifier && !event.ctrlKey && !event.shiftKey) return;
        if (msg.deleted === true) return;

        const executeDoubleClick = () => {
            const action = isMe ? settings.store.doubleClickAction : settings.store.doubleClickOthersAction;
            if (action === ClickAction.NONE) return;

            if (action === ClickAction.EDIT) {
                if (!isMe) return;
                if (EditStore.isEditing(channel.id, msg.id) || msg.state !== "SENT") return;
                MessageActions.startEditMessage(channel.id, msg.id, msg.content);
            } else if (action === ClickAction.REPLY) {
                if (isMe) return;
                if (channel.guild_id && !PermissionStore.can(PermissionsBits.SEND_MESSAGES, channel)) {
                    showPermissionWarning("send message");
                    return;
                }
                if (!MessageTypeSets.REPLYABLE.has(msg.type) || msg.hasFlag(MessageFlags.EPHEMERAL)) {
                    showPermissionWarning("reply to this message");
                    return;
                }

                const isShiftPress = event.shiftKey && !settings.store.requireModifier;
                const shouldMention = isPluginEnabled(NoReplyMentionPlugin.name)
                    ? NoReplyMentionPlugin.shouldMention(msg, isShiftPress)
                    : !isShiftPress;

                FluxDispatcher.dispatch({
                    type: "CREATE_PENDING_REPLY",
                    channel,
                    message: msg,
                    shouldMention,
                    showMentionToggle: channel.guild_id !== null
                });
            } else if (action === ClickAction.COPY_CONTENT) {
                copyWithToast(msg.content || "", "Message content copied!");
            } else if (action === ClickAction.COPY_LINK) {
                const link = `https://discord.com/channels/${channel.guild_id ?? "@me"}/${channel.id}/${msg.id}`;
                copyWithToast(link, "Message link copied!");
            } else if (action === ClickAction.REACT) {
                if (!PermissionStore.can(PermissionsBits.ADD_REACTIONS, channel) && !PermissionStore.can(PermissionsBits.READ_MESSAGE_HISTORY, channel)) {
                    showPermissionWarning("add reaction");
                    return;
                }
                react(channel.id, msg.id, settings.store.reactEmoji, channel);
            } else if (action === ClickAction.PIN) {
                if (!PermissionStore.can(PermissionsBits.MANAGE_MESSAGES, channel)) {
                    showPermissionWarning("pin message");
                    return;
                }
                MessageActions.pinMessage(channel.id, msg.id);
            }
        };

        if (settings.store.tripleClickAction !== ClickAction.NONE) {
            if (doubleClickTimeout) {
                clearTimeout(doubleClickTimeout);
            }
            pendingDoubleClickAction = executeDoubleClick;
            doubleClickTimeout = setTimeout(() => {
                pendingDoubleClickAction?.();
                pendingDoubleClickAction = null;
                doubleClickTimeout = null;
            }, 300);
            event.preventDefault();
        } else {
            executeDoubleClick();
            event.preventDefault();
        }
    },
});
