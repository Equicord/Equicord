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

type Modifier = "NONE" | "SHIFT" | "CTRL" | "ALT" | "BACKSPACE";
type ClickAction = "NONE" | "DELETE" | "COPY_LINK" | "COPY_ID" | "EDIT" | "REPLY" | "REACT" | "OPEN_THREAD" | "OPEN_TAB" | "EDIT_REPLY";

const modifierOptions: { label: string; value: Modifier; }[] = [
    { label: "None", value: "NONE" },
    { label: "Shift", value: "SHIFT" },
    { label: "Ctrl", value: "CTRL" },
    { label: "Alt", value: "ALT" },
    { label: "Backspace", value: "BACKSPACE" }
];

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

const settings = definePluginSettings({
    enableDelete: {
        type: OptionType.BOOLEAN,
        description: "Enable delete action (requires permission or own message)",
        default: true
    },
    enableCopyLink: {
        type: OptionType.BOOLEAN,
        description: "Enable copying message link action",
        default: true
    },
    enableCopyId: {
        type: OptionType.BOOLEAN,
        description: "Enable copying message ID action",
        default: false
    },
    enableEdit: {
        type: OptionType.BOOLEAN,
        description: "Enable edit message action (own messages only)",
        default: true
    },
    enableReply: {
        type: OptionType.BOOLEAN,
        description: "Enable reply to message action",
        default: true
    },
    enableReact: {
        type: OptionType.BOOLEAN,
        description: "Enable react with emoji action",
        default: false
    },
    enableOpenThread: {
        type: OptionType.BOOLEAN,
        description: "Enable open in thread action",
        default: false
    },
    enableOpenTab: {
        type: OptionType.BOOLEAN,
        description: "Enable open in background tab action",
        default: false
    },
    reactEmoji: {
        type: OptionType.STRING,
        description: "Emoji to react with (e.g. 💀 or pepe:123456789)",
        default: "💀"
    },
    singleClickAction: {
        type: OptionType.SELECT,
        description: "Action to perform on single left-click with modifier",
        options: [
            { label: "None", value: "NONE", default: true },
            { label: "Delete", value: "DELETE" },
            { label: "Copy Link", value: "COPY_LINK" },
            { label: "Copy ID", value: "COPY_ID" },
            { label: "React", value: "REACT" },
            { label: "Open in Thread", value: "OPEN_THREAD" },
            { label: "Open in Background Tab", value: "OPEN_TAB" }
        ]
    },
    singleClickModifier: {
        type: OptionType.SELECT,
        description: "Modifier required for single left-click action",
        options: [
            { label: "Backspace", value: "BACKSPACE", default: true },
            { label: "None", value: "NONE" },
            { label: "Shift", value: "SHIFT" },
            { label: "Ctrl", value: "CTRL" },
            { label: "Alt", value: "ALT" }
        ]
    },
    doubleClickAction: {
        type: OptionType.SELECT,
        description: "Action to perform on double-click",
        options: [
            { label: "None", value: "NONE" },
            { label: "Delete", value: "DELETE" },
            { label: "Copy Link", value: "COPY_LINK" },
            { label: "Copy ID", value: "COPY_ID" },
            { label: "Edit (Own) / Reply", value: "EDIT_REPLY", default: true },
            { label: "Edit (Own Only)", value: "EDIT" },
            { label: "Reply Only", value: "REPLY" },
            { label: "React", value: "REACT" },
            { label: "Open in Thread", value: "OPEN_THREAD" },
            { label: "Open in Background Tab", value: "OPEN_TAB" }
        ]
    },
    doubleClickModifier: {
        type: OptionType.SELECT,
        description: "Modifier required for double-click action",
        options: modifierOptions
    },
    tripleClickAction: {
        type: OptionType.SELECT,
        description: "Action to perform on triple-click",
        options: [
            { label: "None", value: "NONE" },
            { label: "Delete", value: "DELETE" },
            { label: "Copy Link", value: "COPY_LINK" },
            { label: "Copy ID", value: "COPY_ID" },
            { label: "Edit (Own) / Reply", value: "EDIT_REPLY" },
            { label: "Edit (Own Only)", value: "EDIT" },
            { label: "Reply Only", value: "REPLY" },
            { label: "React", value: "REACT", default: true },
            { label: "Open in Thread", value: "OPEN_THREAD" },
            { label: "Open in Background Tab", value: "OPEN_TAB" }
        ]
    },
    tripleClickModifier: {
        type: OptionType.SELECT,
        description: "Modifier required for triple-click action",
        options: modifierOptions
    },
    middleClickAction: {
        type: OptionType.SELECT,
        description: "Action to perform on middle-click",
        options: [
            { label: "None", value: "NONE" },
            { label: "Delete", value: "DELETE" },
            { label: "Copy Link", value: "COPY_LINK" },
            { label: "Copy ID", value: "COPY_ID", default: true },
            { label: "Edit (Own) / Reply", value: "EDIT_REPLY" },
            { label: "Edit (Own Only)", value: "EDIT" },
            { label: "Reply Only", value: "REPLY" },
            { label: "React", value: "REACT" },
            { label: "Open in Thread", value: "OPEN_THREAD" },
            { label: "Open in Background Tab", value: "OPEN_TAB" }
        ]
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

async function toggleReaction(channelId: string, messageId: string, emoji: string, channel: { id: string; }, msg: Message) {
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

async function copyMessageLink(msg: Message, channel: { id: string; guild_id?: string | null; }) {
    const guildId = channel.guild_id ?? "dm";
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

function openInNewTab(msg: Message, channel: { id: string; guild_id?: string | null; }) {
    const guildId = channel.guild_id ?? "dm";
    const link = `https://discord.com/channels/${guildId}/${channel.id}/${msg.id}`;
    window.open(link, "_blank");
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
    channel: { id: string; guild_id?: string | null; isDM?: () => boolean; isSystemDM?: () => boolean; },
    event: MouseEvent
) {
    const myId = AuthenticationStore.getId();
    const isMe = msg.author.id === myId;
    const isSelfInvokedUserApp = msg.interactionMetadata?.authorizing_integration_owners?.[ApplicationIntegrationType.USER_INSTALL] === myId;

    switch (action) {
        case "DELETE":
            if (!settings.store.enableDelete) return;
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
            if (!settings.store.enableCopyLink) return;
            await copyMessageLink(msg, channel);
            event.preventDefault();
            break;

        case "COPY_ID":
            if (!settings.store.enableCopyId) return;
            await copyMessageId(msg);
            event.preventDefault();
            break;

        case "EDIT":
            if (!settings.store.enableEdit) return;
            if (!isMe) return;
            if (EditMessageStore.isEditing(channel.id, msg.id) || msg.state !== "SENT") return;
            MessageActions.startEditMessage(channel.id, msg.id, msg.content);
            event.preventDefault();
            break;

        case "REPLY":
            if (!settings.store.enableReply) return;
            if (!MessageTypeSets.REPLYABLE.has(msg.type) || msg.hasFlag(MessageFlags.EPHEMERAL)) return;
            if (channel.guild_id && !PermissionStore.can(PermissionsBits.SEND_MESSAGES, channel)) return;

            const isShiftPress = event.shiftKey && settings.store.doubleClickAction === "EDIT_REPLY";
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
            if (isMe && settings.store.enableEdit && EditMessageStore.isEditing(channel.id, msg.id) === false && msg.state === "SENT") {
                MessageActions.startEditMessage(channel.id, msg.id, msg.content);
            } else if (settings.store.enableReply) {
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
            }
            event.preventDefault();
            break;

        case "REACT":
            if (!settings.store.enableReact) return;
            await toggleReaction(channel.id, msg.id, settings.store.reactEmoji, channel, msg);
            event.preventDefault();
            break;

        case "OPEN_THREAD":
            if (!settings.store.enableOpenThread) return;
            openInThread(msg, channel);
            event.preventDefault();
            break;

        case "OPEN_TAB":
            if (!settings.store.enableOpenTab) return;
            openInNewTab(msg, channel);
            event.preventDefault();
            break;

        case "NONE":
            break;
    }
}

export default definePlugin({
    name: "MessageClickActions",
    description: "Customize click actions on messages: delete, copy link/ID, edit, reply, react, and more.",
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
        const singleClickAction = settings.store.singleClickAction as ClickAction;
        const doubleClickAction = settings.store.doubleClickAction as ClickAction;
        const tripleClickAction = settings.store.tripleClickAction as ClickAction;
        const middleClickAction = settings.store.middleClickAction as ClickAction;

        const singleClickModifier = settings.store.singleClickModifier as Modifier;
        const doubleClickModifier = settings.store.doubleClickModifier as Modifier;
        const tripleClickModifier = settings.store.tripleClickModifier as Modifier;

        const isDM = channel.isDM?.() ?? false;
        const isSystemDM = channel.isSystemDM?.() ?? false;

        if ((settings.store.disableInDms && isDM) || (settings.store.disableInSystemDms && isSystemDM)) return;

        const isSingleClick = event.detail === 1 && event.button === 0;
        const isDoubleClick = event.detail === 2;
        const isTripleClick = event.detail === 3;
        const isMiddleClick = event.button === 1 && event.detail === 1;

        if (isMiddleClick) {
            if (middleClickAction !== "NONE") {
                executeAction(middleClickAction, msg, channel, event);
            }
            return;
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

        if (!isDoubleClick) {
            if (isSingleClick && isModifierPressed(singleClickModifier) && singleClickAction !== "NONE") {
                executeAction(singleClickAction, msg, channel, event);
            }
        }

        if (channel.guild_id && !PermissionStore.can(PermissionsBits.SEND_MESSAGES, channel)) return;
        if (msg.deleted === true) return;

        const executeDoubleClick = () => {
            if (doubleClickAction !== "NONE") {
                executeAction(doubleClickAction, msg, channel, event);
            }
        };

        const canTripleClick = isModifierPressed(tripleClickModifier) && tripleClickAction !== "NONE";

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
            event.preventDefault();
        } else if (isModifierPressed(doubleClickModifier) || (doubleClickModifier === "NONE" && settings.store.doubleClickAction !== "EDIT_REPLY")) {
            executeDoubleClick();
            event.preventDefault();
        } else if (settings.store.doubleClickAction === "EDIT_REPLY") {
            executeDoubleClick();
            event.preventDefault();
        }
    },
});
