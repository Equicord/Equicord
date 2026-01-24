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
import type { Message } from "@vencord/discord-types";
import { ApplicationIntegrationType, MessageFlags } from "@vencord/discord-types/enums";
import { AuthenticationStore, Constants, EditMessageStore, FluxDispatcher, MessageActions, MessageTypeSets, PermissionsBits, PermissionStore, PinActions, RestAPI, showToast, Toasts, WindowStore } from "@webpack/common";

type Modifier = "NONE" | "SHIFT" | "CTRL" | "ALT" | "BACKSPACE" | "DELETE";
type ClickAction = "NONE" | "DELETE" | "COPY_LINK" | "COPY_ID" | "COPY_CONTENT" | "COPY_USER_ID" | "EDIT" | "REPLY" | "REACT" | "OPEN_THREAD" | "OPEN_TAB" | "EDIT_REPLY" | "QUOTE" | "PIN";

const actions: { label: string; value: ClickAction; }[] = [
    { label: "None", value: "NONE" },
    { label: "Delete", value: "DELETE" },
    { label: "Copy Link", value: "COPY_LINK" },
    { label: "Copy ID", value: "COPY_ID" },
    { label: "Copy Content", value: "COPY_CONTENT" },
    { label: "Copy User ID", value: "COPY_USER_ID" },
    { label: "Edit", value: "EDIT" },
    { label: "Reply", value: "REPLY" },
    { label: "React", value: "REACT" },
    { label: "Open Thread", value: "OPEN_THREAD" },
    { label: "Open Tab", value: "OPEN_TAB" }
];

const doubleClickOwnActions: { label: string; value: ClickAction; }[] = [
    { label: "None", value: "NONE" },
    { label: "Reply", value: "REPLY" },
    { label: "Edit", value: "EDIT" },
    { label: "Quote", value: "QUOTE" },
    { label: "Copy Content", value: "COPY_CONTENT" },
    { label: "Copy Link", value: "COPY_LINK" },
    { label: "Copy ID", value: "COPY_ID" },
    { label: "Copy User ID", value: "COPY_USER_ID" },
    { label: "React", value: "REACT" },
    { label: "Pin", value: "PIN" }
];

const doubleClickOthersActions: { label: string; value: ClickAction; }[] = [
    { label: "None", value: "NONE" },
    { label: "Reply", value: "REPLY" },
    { label: "Quote", value: "QUOTE" },
    { label: "Copy Content", value: "COPY_CONTENT" },
    { label: "Copy Link", value: "COPY_LINK" },
    { label: "Copy ID", value: "COPY_ID" },
    { label: "Copy User ID", value: "COPY_USER_ID" },
    { label: "React", value: "REACT" },
    { label: "Pin", value: "PIN" }
];

const modifiers: { label: string; value: Modifier; }[] = [
    { label: "None", value: "NONE" },
    { label: "Shift", value: "SHIFT" },
    { label: "Ctrl", value: "CTRL" },
    { label: "Alt", value: "ALT" }
];

const singleClickModifiers: { label: string; value: Modifier; }[] = [
    { label: "Backspace", value: "BACKSPACE" },
    { label: "Delete", value: "DELETE" },
    ...modifiers
];

const pressedModifiers = new Set<Modifier>();
const keydown = (e: KeyboardEvent) => {
    const mod = modifierFromKey(e);
    if (mod) pressedModifiers.add(mod);
    if (e.key === "Backspace") pressedModifiers.add("BACKSPACE");
    if (e.key === "Delete") pressedModifiers.add("DELETE");
};
const keyup = (e: KeyboardEvent) => {
    const mod = modifierFromKey(e);
    if (mod) pressedModifiers.delete(mod);
    if (e.key === "Backspace") pressedModifiers.delete("BACKSPACE");
    if (e.key === "Delete") pressedModifiers.delete("DELETE");
};
const focusChanged = () => {
    if (!WindowStore.isFocused()) {
        pressedModifiers.clear();
    }
};

let lastMouseDownTime = 0;
const onMouseDown = () => {
    lastMouseDownTime = Date.now();
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
let singleClickTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingDoubleClickAction: (() => void) | null = null;

const settings = definePluginSettings({
    reactEmoji: {
        type: OptionType.STRING,
        description: "Emoji to use for react actions",
        default: "💀"
    },
    singleClickAction: {
        type: OptionType.SELECT,
        description: "Action on single click with modifier",
        options: actions,
        default: "DELETE"
    },
    singleClickModifier: {
        type: OptionType.SELECT,
        description: "Modifier required for single click action",
        options: singleClickModifiers,
        default: "BACKSPACE"
    },
    doubleClickAction: {
        type: OptionType.SELECT,
        description: "Action on double-click (your messages)",
        options: doubleClickOwnActions,
        default: "EDIT"
    },
    doubleClickOthersAction: {
        type: OptionType.SELECT,
        description: "Action on double-click (others' messages)",
        options: doubleClickOthersActions,
        default: "REPLY"
    },
    doubleClickModifier: {
        type: OptionType.SELECT,
        description: "Modifier required for double-click action",
        options: modifiers,
        default: "NONE"
    },
    tripleClickAction: {
        type: OptionType.SELECT,
        description: "Action on triple-click",
        options: actions,
        default: "REACT"
    },
    tripleClickModifier: {
        type: OptionType.SELECT,
        description: "Modifier required for triple-click action",
        options: modifiers,
        default: "NONE"
    },
    disableInDms: {
        type: OptionType.BOOLEAN,
        description: "Disable all click actions in direct messages",
        default: false
    },
    disableInSystemDms: {
        type: OptionType.BOOLEAN,
        description: "Disable all click actions in system DMs",
        default: true
    },
    clickTimeout: {
        type: OptionType.NUMBER,
        description: "Timeout to distinguish double/triple clicks (ms)",
        default: 300
    },
    selectionHoldTimeout: {
        type: OptionType.NUMBER,
        description: "Timeout to allow text selection (ms)",
        default: 300
    },
    quoteWithReply: {
        type: OptionType.BOOLEAN,
        description: "When quoting, also reply to the message",
        default: true
    },
    useSelectionForQuote: {
        type: OptionType.BOOLEAN,
        description: "When quoting, use selected text if available",
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

function isMessageReplyable(msg: Message) {
    return MessageTypeSets.REPLYABLE.has(msg.type) && !msg.hasFlag(MessageFlags.EPHEMERAL);
}

async function toggleReaction(channelId: string, messageId: string, emoji: string, channel: { id: string; guild_id?: string | null; }, msg: Message) {
    const trimmed = emoji.trim();
    if (!trimmed) return;

    if (channel.guild_id && (!PermissionStore.can(PermissionsBits.ADD_REACTIONS, channel) || !PermissionStore.can(PermissionsBits.READ_MESSAGE_HISTORY, channel))) {
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

async function copyMessageLink(msg: Message, channel: { id: string; guild_id?: string | null; }) {
    const guildId = channel.guild_id ?? "@me";
    const link = `https://discord.com/channels/${guildId}/${channel.id}/${msg.id}`;

    try {
        await navigator.clipboard.writeText(link);
        showToast("Message link copied", Toasts.Type.SUCCESS);
    } catch (e) {
        new Logger("MessageClickActions").error("Failed to copy link:", e);
    }
}

async function copyMessageId(msg: Message) {
    try {
        await navigator.clipboard.writeText(msg.id);
        showToast("Message ID copied", Toasts.Type.SUCCESS);
    } catch (e) {
        new Logger("MessageClickActions").error("Failed to copy message ID:", e);
    }
}

async function copyUserId(msg: Message) {
    try {
        await navigator.clipboard.writeText(msg.author.id);
        showToast("User ID copied", Toasts.Type.SUCCESS);
    } catch (e) {
        new Logger("MessageClickActions").error("Failed to copy user ID:", e);
    }
}

function togglePin(channel: { id: string; }, msg: Message) {
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

function quoteMessage(channel: { id: string; guild_id?: string | null; isPrivate?: () => boolean; }, msg: Message) {
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
            showMentionToggle: !channel.isPrivate?.()
        });
    }
}

function openInNewTab(msg: Message, channel: { id: string; guild_id?: string | null; }) {
    const guildId = channel.guild_id ?? "@me";
    const link = `https://discord.com/channels/${guildId}/${channel.id}/${msg.id}`;
    VencordNative.native.openExternal(link);
}

function openInThread(msg: Message, channel: { id: string; }) {
    FluxDispatcher.dispatch({
        type: "OPEN_THREAD_FLOW_MODAL",
        channelId: channel.id,
        messageId: msg.id
    });
}

async function executeAction(
    action: ClickAction,
    msg: Message,
    channel: { id: string; guild_id?: string | null; isDM?: () => boolean; isSystemDM?: () => boolean; isPrivate?: () => boolean; },
    event: MouseEvent
) {
    const myId = AuthenticationStore.getId();
    const isMe = msg.author.id === myId;
    const isSelfInvokedUserApp = msg.interactionMetadata?.authorizing_integration_owners?.[ApplicationIntegrationType.USER_INSTALL] === myId;

    switch (action) {
        case "DELETE":
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
            break;

        case "COPY_LINK":
            await copyMessageLink(msg, channel);
            event.preventDefault();
            break;

        case "COPY_ID":
            await copyMessageId(msg);
            event.preventDefault();
            break;

        case "COPY_CONTENT":
            copyWithToast(msg.content || "", "Message content copied!");
            event.preventDefault();
            break;

        case "COPY_USER_ID":
            await copyUserId(msg);
            event.preventDefault();
            break;

        case "EDIT":
            if (!isMe) return;
            if (EditMessageStore.isEditing(channel.id, msg.id) || msg.state !== "SENT") return;
            MessageActions.startEditMessage(channel.id, msg.id, msg.content);
            event.preventDefault();
            break;

        case "REPLY":
            if (!MessageTypeSets.REPLYABLE.has(msg.type) || msg.hasFlag(MessageFlags.EPHEMERAL)) return;
            if (channel.guild_id && !PermissionStore.can(PermissionsBits.SEND_MESSAGES, channel)) return;

            const isShiftPress = event.shiftKey;
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
            event.preventDefault();
            break;

        case "EDIT_REPLY":
            if (isMe) {
                if (EditMessageStore.isEditing(channel.id, msg.id) || msg.state !== "SENT") return;
                MessageActions.startEditMessage(channel.id, msg.id, msg.content);
            } else {
                if (!MessageTypeSets.REPLYABLE.has(msg.type) || msg.hasFlag(MessageFlags.EPHEMERAL)) return;
                if (channel.guild_id && !PermissionStore.can(PermissionsBits.SEND_MESSAGES, channel)) return;

                const shouldMentionReply = isPluginEnabled(NoReplyMentionPlugin.name)
                    ? NoReplyMentionPlugin.shouldMention(msg, false)
                    : true;

                FluxDispatcher.dispatch({
                    type: "CREATE_PENDING_REPLY",
                    channel,
                    message: msg,
                    shouldMention: shouldMentionReply,
                    showMentionToggle: channel.guild_id !== null
                });
            }
            event.preventDefault();
            break;

        case "QUOTE":
            quoteMessage(channel, msg);
            event.preventDefault();
            break;

        case "PIN":
            togglePin(channel, msg);
            event.preventDefault();
            break;

        case "REACT":
            await toggleReaction(channel.id, msg.id, settings.store.reactEmoji, channel, msg);
            event.preventDefault();
            break;

        case "OPEN_THREAD":
            openInThread(msg, channel);
            event.preventDefault();
            break;

        case "OPEN_TAB":
            openInNewTab(msg, channel);
            event.preventDefault();
            break;

        case "NONE":
            break;
    }
}

export default definePlugin({
    name: "MessageClickActions",
    description: "Customize click actions on messages.",
    authors: [Devs.Ven, EquicordDevs.keyages, EquicordDevs.ZcraftElite],
    isModified: true,

    settings,

    start() {
        document.addEventListener("keydown", keydown);
        document.addEventListener("keyup", keyup);
        document.addEventListener("mousedown", onMouseDown);
        WindowStore.addChangeListener(focusChanged);
    },

    stop() {
        document.removeEventListener("keydown", keydown);
        document.removeEventListener("keyup", keyup);
        document.removeEventListener("mousedown", onMouseDown);
        WindowStore.removeChangeListener(focusChanged);

        if (doubleClickTimeout) {
            clearTimeout(doubleClickTimeout);
            doubleClickTimeout = null;
        }
        if (singleClickTimeout) {
            clearTimeout(singleClickTimeout);
            singleClickTimeout = null;
        }
        pendingDoubleClickAction = null;
    },

    onMessageClick(msg, channel, event) {
        const target = event.target as HTMLElement;
        if (target.closest('a, button, input, img, [class*="repliedTextPreview"], [class*="threadMessageAccessory"]')) return;
        if (!target.closest('[class*="message"]')) return;

        const myId = AuthenticationStore.getId();
        const isMe = msg.author.id === myId;
        const isDM = channel.isDM();
        const isSystemDM = channel.isSystemDM();

        if ((settings.store.disableInDms && isDM) || (settings.store.disableInSystemDms && isSystemDM)) return;

        const singleClickAction = settings.store.singleClickAction as ClickAction;
        const doubleClickAction = isMe
            ? (settings.store.doubleClickAction as ClickAction)
            : (settings.store.doubleClickOthersAction as ClickAction);
        const tripleClickAction = settings.store.tripleClickAction as ClickAction;

        const singleClickModifier = settings.store.singleClickModifier as Modifier;
        const doubleClickModifier = settings.store.doubleClickModifier as Modifier;
        const tripleClickModifier = settings.store.tripleClickModifier as Modifier;

        const isSingleClick = event.detail === 1 && event.button === 0;
        const isDoubleClick = event.detail === 2;
        const isTripleClick = event.detail === 3;

        if (singleClickTimeout) {
            clearTimeout(singleClickTimeout);
            singleClickTimeout = null;
        }

        if (isTripleClick) {
            if (doubleClickTimeout) {
                clearTimeout(doubleClickTimeout);
                doubleClickTimeout = null;
                pendingDoubleClickAction = null;
            }

            if (isModifierPressed(tripleClickModifier) && tripleClickAction !== "NONE") {
                executeAction(tripleClickAction, msg, channel, event);
            }
            return;
        }

        const canDoubleClick = (isModifierPressed(doubleClickModifier) || doubleClickModifier === "NONE") && doubleClickAction !== "NONE";
        const canTripleClick = isModifierPressed(tripleClickModifier) && tripleClickAction !== "NONE";

        if (isDoubleClick) {
            if (singleClickTimeout) {
                clearTimeout(singleClickTimeout);
                singleClickTimeout = null;
            }

            if (Date.now() - lastMouseDownTime > settings.store.selectionHoldTimeout) return;

            const executeDoubleClick = () => {
                if (channel.guild_id && !PermissionStore.can(PermissionsBits.SEND_MESSAGES, channel)) return;
                if (msg.deleted === true) return;
                if (canDoubleClick) {
                    executeAction(doubleClickAction, msg, channel, event);
                }
            };

            if (canTripleClick) {
                if (doubleClickTimeout) {
                    clearTimeout(doubleClickTimeout);
                }
                pendingDoubleClickAction = executeDoubleClick;
                doubleClickTimeout = setTimeout(() => {
                    pendingDoubleClickAction?.();
                    pendingDoubleClickAction = null;
                    doubleClickTimeout = null;
                }, settings.store.clickTimeout);
            } else {
                executeDoubleClick();
            }
            event.preventDefault();
            return;
        }

        if (isSingleClick) {
            const executeSingleClick = () => {
                if (isModifierPressed(singleClickModifier) && singleClickAction !== "NONE") {
                    executeAction(singleClickAction, msg, channel, event);
                }
            };

            if (canDoubleClick) {
                singleClickTimeout = setTimeout(() => {
                    executeSingleClick();
                    singleClickTimeout = null;
                }, settings.store.clickTimeout);
            } else {
                executeSingleClick();
            }
        }
    },
});
