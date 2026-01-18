/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { isPluginEnabled } from "@api/PluginManager";
import { definePluginSettings } from "@api/Settings";
import NoReplyMentionPlugin from "@plugins/noReplyMention";
import { Devs, EquicordDevs } from "@utils/constants";
import { copyWithToast, insertTextIntoChatInputBox } from "@utils/discord";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { Channel, Message } from "@vencord/discord-types";
import { ApplicationIntegrationType, MessageFlags } from "@vencord/discord-types/enums";
import { AuthenticationStore, Constants, EditMessageStore, FluxDispatcher, MessageActions, MessageTypeSets, PermissionsBits, PermissionStore, PinActions, RestAPI, Toasts, WindowStore } from "@webpack/common";

type Modifier = "NONE" | "SHIFT" | "CTRL" | "ALT" | "BACKSPACE";

const pressedModifiers = new Set<Modifier>();
const keydown = (e: KeyboardEvent) => {
    const mod = modifierFromKey(e);
    if (mod) pressedModifiers.add(mod);
    if (e.key === "Backspace") pressedModifiers.add("BACKSPACE");
};
const keyup = (e: KeyboardEvent) => {
    const mod = modifierFromKey(e);
    if (mod) pressedModifiers.delete(mod);
    if (e.key === "Backspace") pressedModifiers.delete("BACKSPACE");
};
const focusChanged = () => {
    pressedModifiers.clear();
};

function modifierFromKey(e: KeyboardEvent): Modifier | null {
    if (e.key === "Shift") return "SHIFT";
    if (e.key === "Control") return "CTRL";
    if (e.key === "Alt") return "ALT";
    return null;
}

function isModifierPressed(modifier: Modifier): boolean {
    return modifier === "NONE" || pressedModifiers.has(modifier);
}

let doubleClickTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingDoubleClickAction: (() => void) | null = null;

enum ClickAction {
    NONE = "none",
    DELETE = "delete",
    EDIT = "edit",
    REPLY = "reply",
    COPY_CONTENT = "copy_content",
    COPY_LINK = "copy_link",
    COPY_MESSAGE_ID = "copy_message_id",
    COPY_USER_ID = "copy_user_id",
    QUOTE = "quote",
    REACT = "react",
    PIN = "pin"
}

const settings = definePluginSettings({
    enableDeleteOnClick: {
        type: OptionType.BOOLEAN,
        description: "Enable delete on click with modifier",
        default: true
    },
    deleteModifier: {
        type: OptionType.SELECT,
        description: "Modifier required to delete on click",
        options: [
            { label: "Backspace", value: "BACKSPACE", default: true },
            { label: "None", value: "NONE" },
            { label: "Shift", value: "SHIFT" },
            { label: "Ctrl", value: "CTRL" },
            { label: "Alt", value: "ALT" }
        ]
    },
    enableDoubleClickToEdit: {
        type: OptionType.BOOLEAN,
        description: "Enable double click to edit",
        default: true
    },
    editModifier: {
        type: OptionType.SELECT,
        description: "Modifier required to edit on double click",
        options: [
            { label: "None", value: "NONE", default: true },
            { label: "Shift", value: "SHIFT" },
            { label: "Ctrl", value: "CTRL" },
            { label: "Alt", value: "ALT" }
        ]
    },
    enableDoubleClickToReply: {
        type: OptionType.BOOLEAN,
        description: "Enable double click to reply",
        default: true
    },
    replyModifier: {
        type: OptionType.SELECT,
        description: "Modifier required to reply on double click",
        options: [
            { label: "None", value: "NONE", default: true },
            { label: "Shift", value: "SHIFT" },
            { label: "Ctrl", value: "CTRL" },
            { label: "Alt", value: "ALT" }
        ]
    },
    enableTripleClickToReact: {
        type: OptionType.BOOLEAN,
        description: "Enable triple click to react with an emoji",
        default: false
    },
    reactModifier: {
        type: OptionType.SELECT,
        description: "Modifier required to react on triple click",
        options: [
            { label: "None", value: "NONE", default: true },
            { label: "Shift", value: "SHIFT" },
            { label: "Ctrl", value: "CTRL" },
            { label: "Alt", value: "ALT" }
        ]
    },
    reactEmoji: {
        type: OptionType.STRING,
        description: "Emoji to use for react actions (e.g. 💀 or pepe:123456789)",
        default: "💀"
    },
    disableInDms: {
        type: OptionType.BOOLEAN,
        description: "Disable all click actions in direct messages",
        default: false
    },
    disableInSystemDms: {
        type: OptionType.BOOLEAN,
        description: "Disable all click actions in system DMs (e.g. Clyde, Discord)",
        default: true
    },
    clickTimeout: {
        type: OptionType.NUMBER,
        description: "Timeout in milliseconds to distinguish double/triple clicks",
        default: 300
    },
    quoteWithReply: {
        type: OptionType.BOOLEAN,
        description: "When quoting, also reply to the message",
        default: true
    },
    useSelectionForQuote: {
        type: OptionType.BOOLEAN,
        description: "When quoting, use selected text if available (otherwise quotes full message)",
        default: false
    }
});

function showWarning(message: string) {
    Toasts.show({
        message,
        type: Toasts.Type.FAILURE,
        id: Toasts.genId(),
        options: {
            duration: 3000
        }
    });
}

function executeCommonAction(action: ClickAction, channel: Channel, msg: Message): boolean {
    switch (action) {
        case ClickAction.COPY_CONTENT:
            copyWithToast(msg.content || "", "Message content copied!");
            return true;
        case ClickAction.COPY_LINK:
            copyWithToast(`https://discord.com/channels/${channel.guild_id ?? "@me"}/${channel.id}/${msg.id}`, "Message link copied!");
            return true;
        case ClickAction.COPY_MESSAGE_ID:
            copyWithToast(msg.id, "Message ID copied!");
            return true;
        case ClickAction.COPY_USER_ID:
            copyWithToast(msg.author.id, "User ID copied!");
            return true;
    }
    return false;
}

function isMessageReplyable(msg: Message) {
    return MessageTypeSets.REPLYABLE.has(msg.type) && !msg.hasFlag(MessageFlags.EPHEMERAL);
}

async function toggleReaction(channelId: string, messageId: string, emoji: string, channel: Channel, msg: Message) {
    const trimmed = emoji.trim();
    if (!trimmed) return;

    if (!PermissionStore.can(PermissionsBits.ADD_REACTIONS, channel) || !PermissionStore.can(PermissionsBits.READ_MESSAGE_HISTORY, channel)) {
        showWarning("Cannot react: Missing permissions");
        return;
    }

    const customMatch = trimmed.match(/^:?([\w-]+):(\d+)$/);
    const emojiParam = customMatch
        ? `${customMatch[1]}:${customMatch[2]}`
        : trimmed;

    const hasReacted = msg.reactions?.some(r => {
        const reactionEmoji = r.emoji.id
            ? `${r.emoji.name}:${r.emoji.id}`
            : r.emoji.name;
        return r.me && reactionEmoji === emojiParam;
    });

    try {
        if (hasReacted) {
            await RestAPI.del({
                url: Constants.Endpoints.REACTION(channelId, messageId, emojiParam, "@me")
            });
        } else {
            await RestAPI.put({
                url: Constants.Endpoints.REACTION(channelId, messageId, emojiParam, "@me")
            });
        }
    } catch (e) {
        new Logger("MessageClickActions").error("Failed to toggle reaction:", e);
    }
}

function togglePin(channel: Channel, msg: Message) {
    if (!PermissionStore.can(PermissionsBits.MANAGE_MESSAGES, channel)) {
        showWarning("Cannot pin: Missing permissions");
        return;
    }

    if (msg.pinned) {
        PinActions.unpinMessage(channel, msg.id);
    } else {
        PinActions.pinMessage(channel, msg.id);
    }
}

function quoteMessage(channel: Channel, msg: Message) {
    if (!isMessageReplyable(msg)) {
        showWarning("Cannot quote this message type");
        return;
    }

    let { content } = msg;
    if (settings.store.useSelectionForQuote) {
        const selection = window.getSelection()?.toString().trim();
        if (selection && msg.content?.includes(selection)) {
            content = selection;
        }
    }
    if (!content) return;

    const quoteText = content.split("\n").map(line => `> ${line}`).join("\n") + "\n";

    insertTextIntoChatInputBox(quoteText);

    if (settings.store.quoteWithReply) {
        FluxDispatcher.dispatch({
            type: "CREATE_PENDING_REPLY",
            channel,
            message: msg,
            shouldMention: false,
            showMentionToggle: !channel.isPrivate()
        });
    }
}

export default definePlugin({
    name: "MessageClickActions",
    description: "Click messages with modifiers to delete, edit, reply, or react. Configure modifiers in settings.",
    authors: [Devs.Ven, EquicordDevs.keyages],
    isModified: true,

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
        const isDM = channel.isDM();
        const isSystemDM = channel.isSystemDM();

        if ((settings.store.disableInDms && isDM) || (settings.store.disableInSystemDms && isSystemDM)) return;

        const deletePressed = isModifierPressed(settings.store.deleteModifier as Modifier);
        const editPressed = isModifierPressed(settings.store.editModifier as Modifier);
        const replyPressed = isModifierPressed(settings.store.replyModifier as Modifier);
        const reactPressed = isModifierPressed(settings.store.reactModifier as Modifier);

        if (deletePressed) {
            if (!settings.store.enableDeleteOnClick) return;
            if (!(isMe || PermissionStore.can(PermissionsBits.MANAGE_MESSAGES, channel) || isSelfInvokedUserApp)) return;

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
            event.preventDefault();
            return;
        }

        if (event.detail === 3) {
            if (doubleClickTimeout) {
                clearTimeout(doubleClickTimeout);
                doubleClickTimeout = null;
                pendingDoubleClickAction = null;
            }

            if (settings.store.enableTripleClickToReact && reactPressed) {
                toggleReaction(channel.id, msg.id, settings.store.reactEmoji, channel, msg);
                event.preventDefault();
                return;
            }
        }

        if (event.detail !== 2) return;
        if (channel.guild_id && !PermissionStore.can(PermissionsBits.SEND_MESSAGES, channel)) return;
        if (msg.deleted === true) return;

        const executeDoubleClick = () => {
            if (isMe) {
                if (!settings.store.enableDoubleClickToEdit || EditMessageStore.isEditing(channel.id, msg.id) || msg.state !== "SENT") return;
                if (!editPressed) return;
                MessageActions.startEditMessage(channel.id, msg.id, msg.content);
            } else {
                if (!settings.store.enableDoubleClickToReply) return;
                if (!replyPressed) return;
                if (!MessageTypeSets.REPLYABLE.has(msg.type) || msg.hasFlag(MessageFlags.EPHEMERAL)) return;

                const isShiftPress = event.shiftKey && settings.store.replyModifier === "NONE";
                const shouldMention = isPluginEnabled(NoReplyMentionPlugin.name)
                    ? NoReplyMentionPlugin.shouldMention(msg, isShiftPress)
                    : !isShiftPress;

                FluxDispatcher.dispatch({
                    type: "CREATE_PENDING_REPLY",
                    channel,
                    message: msg,
                    shouldMention,
                    showMentionToggle: !channel.isPrivate()
                });
            }
        };

        if (settings.store.enableTripleClickToReact && reactPressed) {
            if (doubleClickTimeout) {
                clearTimeout(doubleClickTimeout);
            }
            pendingDoubleClickAction = executeDoubleClick;
            doubleClickTimeout = setTimeout(() => {
                pendingDoubleClickAction?.();
                pendingDoubleClickAction = null;
                doubleClickTimeout = null;
            }, settings.store.clickTimeout);
            event.preventDefault();
        } else {
            executeDoubleClick();
            event.preventDefault();
        }
    },
});
