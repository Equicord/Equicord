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
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import type { Message } from "@vencord/discord-types";
import { ApplicationIntegrationType, MessageFlags } from "@vencord/discord-types/enums";
import { AuthenticationStore, Constants, EditMessageStore, FluxDispatcher, MessageActions, MessageTypeSets, PermissionsBits, PermissionStore, RestAPI, showToast, Toasts, WindowStore } from "@webpack/common";

type Modifier = "NONE" | "SHIFT" | "CTRL" | "ALT" | "BACKSPACE";
type ClickAction = "NONE" | "DELETE" | "COPY_LINK" | "COPY_ID" | "EDIT" | "REPLY" | "REACT" | "OPEN_THREAD" | "OPEN_TAB" | "EDIT_REPLY";

const actions: { label: string; value: ClickAction; }[] = [
    { label: "None", value: "NONE" },
    { label: "Delete", value: "DELETE" },
    { label: "Copy Link", value: "COPY_LINK" },
    { label: "Copy ID", value: "COPY_ID" },
    { label: "Edit", value: "EDIT" },
    { label: "Reply", value: "REPLY" },
    { label: "React", value: "REACT" },
    { label: "Open Thread", value: "OPEN_THREAD" },
    { label: "Open Tab", value: "OPEN_TAB" }
];

const editReplyActions: { label: string; value: ClickAction; }[] = [
    ...actions.slice(0, 4),
    { label: "Edit / Reply", value: "EDIT_REPLY" },
    ...actions.slice(4)
];

const modifiers: { label: string; value: Modifier; }[] = [
    { label: "None", value: "NONE" },
    { label: "Shift", value: "SHIFT" },
    { label: "Ctrl", value: "CTRL" },
    { label: "Alt", value: "ALT" }
];

const singleClickModifiers: { label: string; value: Modifier; }[] = [
    { label: "Backspace", value: "BACKSPACE" },
    ...modifiers
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
    reactEmoji: {
        type: OptionType.STRING,
        description: "",
        default: "💀"
    },
    singleClickAction: {
        type: OptionType.SELECT,
        description: "",
        options: actions,
        default: "DELETE"
    },
    singleClickModifier: {
        type: OptionType.SELECT,
        description: "",
        options: singleClickModifiers,
        default: "BACKSPACE"
    },
    doubleClickAction: {
        type: OptionType.SELECT,
        description: "",
        options: editReplyActions,
        default: "EDIT_REPLY"
    },
    doubleClickModifier: {
        type: OptionType.SELECT,
        description: "",
        options: modifiers,
        default: "NONE"
    },
    tripleClickAction: {
        type: OptionType.SELECT,
        description: "",
        options: actions,
        default: "REACT"
    },
    tripleClickModifier: {
        type: OptionType.SELECT,
        description: "",
        options: modifiers,
        default: "NONE"
    },
    middleClickAction: {
        type: OptionType.SELECT,
        description: "",
        options: editReplyActions,
        default: "COPY_ID"
    },
    clickTimeout: {
        type: OptionType.NUMBER,
        description: "",
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

        case "EDIT":
            if (!isMe) return;
            if (EditMessageStore.isEditing(channel.id, msg.id) || msg.state !== "SENT") return;
            MessageActions.startEditMessage(channel.id, msg.id, msg.content);
            event.preventDefault();
            break;

        case "REPLY":
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
            if (isMe && EditMessageStore.isEditing(channel.id, msg.id) === false && msg.state === "SENT") {
                MessageActions.startEditMessage(channel.id, msg.id, msg.content);
            } else {
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
