/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findGroupChildrenByChildId, type NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import { classNameToSelector } from "@utils/css";
import definePlugin, { OptionType, type PluginNative } from "@utils/types";
import type { Channel, Message } from "@vencord/discord-types";
import { findCssClassesLazy } from "@webpack";
import { ChannelStore, Menu, React, showToast, Toasts } from "@webpack/common";
import type { ReactElement } from "react";

import type { ConversationWindowOptions } from "./native";

const Native = VencordNative.pluginHelpers.ChannelWindows as PluginNative<typeof import("./native")>;
const middleClickButton = 1;
const GuildClasses = findCssClassesLazy("guilds");
const SidebarClasses = findCssClassesLazy("sidebar");
const SidebarListClasses = findCssClassesLazy("sidebarList");
const MemberClasses = findCssClassesLazy("membersWrap", "members");
const ProfilePanelClasses = findCssClassesLazy("profilePanel");
const NowPlayingClasses = findCssClassesLazy("nowPlayingColumn");
const LayoutClasses = findCssClassesLazy("base", "content");
const ChatClasses = findCssClassesLazy("chat", "chatContent");

const settings = definePluginSettings({
    openNativeWindow: {
        type: OptionType.BOOLEAN,
        description: "Use native Electron windows when available.",
        default: true
    },
    fallbackToPopup: {
        type: OptionType.BOOLEAN,
        description: "Fall back to a browser popup if the native window cannot open.",
        default: true
    },
    showFailureToast: {
        type: OptionType.BOOLEAN,
        description: "Show a toast when a conversation window cannot be opened.",
        default: true
    },
    enableMiddleClick: {
        type: OptionType.BOOLEAN,
        description: "Open channels in a window with middle click.",
        default: true
    },
    showChannelContextMenu: {
        type: OptionType.BOOLEAN,
        description: "Add the action to channel context menus.",
        default: true
    },
    showUserContextMenu: {
        type: OptionType.BOOLEAN,
        description: "Add the action to direct message user context menus.",
        default: true
    },
    showMessageContextMenu: {
        type: OptionType.BOOLEAN,
        description: "Add the action to message context menus.",
        default: true
    },
    reuseExistingWindow: {
        type: OptionType.BOOLEAN,
        description: "Reuse an existing window for the same conversation.",
        default: true
    },
    focusExistingWindow: {
        type: OptionType.BOOLEAN,
        description: "Focus an existing conversation window when it is reused.",
        default: true
    },
    compactMode: {
        type: OptionType.BOOLEAN,
        description: "Hide Discord sidebars inside conversation windows.",
        default: true
    },
    autoHideMenuBar: {
        type: OptionType.BOOLEAN,
        description: "Hide the native menu bar in conversation windows.",
        default: true
    },
    devTools: {
        type: OptionType.BOOLEAN,
        description: "Allow DevTools in conversation windows.",
        default: false
    },
    windowWidth: {
        type: OptionType.NUMBER,
        description: "Default conversation window width.",
        default: 1100,
        isValid: (value: number) => Number.isInteger(value) && value >= 320 && value <= 3840 || "Width must be between 320 and 3840 pixels."
    },
    windowHeight: {
        type: OptionType.NUMBER,
        description: "Default conversation window height.",
        default: 800,
        isValid: (value: number) => Number.isInteger(value) && value >= 320 && value <= 2160 || "Height must be between 320 and 2160 pixels."
    },
    minWidth: {
        type: OptionType.NUMBER,
        description: "Minimum conversation window width.",
        default: 720,
        isValid: (value: number) => Number.isInteger(value) && value >= 320 && value <= 3840 || "Minimum width must be between 320 and 3840 pixels."
    },
    minHeight: {
        type: OptionType.NUMBER,
        description: "Minimum conversation window height.",
        default: 480,
        isValid: (value: number) => Number.isInteger(value) && value >= 320 && value <= 2160 || "Minimum height must be between 320 and 2160 pixels."
    },
    windowTitle: {
        type: OptionType.STRING,
        description: "Title for native conversation windows.",
        default: "Discord"
    },
    backgroundColor: {
        type: OptionType.STRING,
        description: "Background color for native conversation windows.",
        default: "#313338",
        isValid: (value: string) => /^#[\da-f]{6}$/i.test(value) || "Background color must be a 6 digit hex color."
    }
});

function clampInteger(value: number, fallback: number, min: number, max: number) {
    if (!Number.isFinite(value)) return fallback;
    return Math.min(Math.max(Math.trunc(value), min), max);
}

function getChannelUrl(channel: Channel) {
    return new URL(`/channels/${channel.guild_id || "@me"}/${channel.id}`, window.location.origin).toString();
}

function toSelector(className: string | undefined) {
    return className ? classNameToSelector(className) : null;
}

function getCompactConversationCss() {
    const hiddenSelectors = [
        "nav[aria-label=\"Servers\"]",
        "[data-list-id=\"guildsnav\"]",
        "[aria-label=\"Private channels\"]",
        "[aria-label=\"Channels\"]",
        "div[data-collapsed]:has([aria-label=\"Private channels\"])",
        "div[data-collapsed]:has([aria-label=\"Channels\"])",
        toSelector(GuildClasses.guilds),
        toSelector(SidebarClasses.sidebar),
        toSelector(SidebarListClasses.sidebarList),
        toSelector(MemberClasses.membersWrap),
        toSelector(MemberClasses.members),
        toSelector(ProfilePanelClasses.profilePanel),
        toSelector(NowPlayingClasses.nowPlayingColumn)
    ].filter((selector): selector is string => Boolean(selector));
    const base = toSelector(LayoutClasses.base);
    const content = toSelector(LayoutClasses.content);
    const chat = toSelector(ChatClasses.chat);
    const chatContent = toSelector(ChatClasses.chatContent);

    return `
        body {
            overflow: hidden !important;
        }

        #app-mount {
            height: 100vh !important;
            width: 100vw !important;
        }

        ${hiddenSelectors.join(",\n        ")} {
            display: none !important;
        }

        ${base && content ? `
        ${base} > ${content} {
            display: flex !important;
            left: 0 !important;
            margin-left: 0 !important;
            max-width: none !important;
            width: 100vw !important;
        }` : ""}

        ${base && content && chat ? `
        #app-mount ${base} > ${content} > ${chat} {
            flex: 1 1 auto !important;
            left: 0 !important;
            margin-left: 0 !important;
            max-width: none !important;
            width: 100vw !important;
        }` : ""}

        ${base && content && chat && chatContent ? `
        #app-mount ${base} > ${content} > ${chat} ${chatContent} {
            flex: 1 1 auto !important;
        }` : ""}
    `;
}

function getWindowOptions(): ConversationWindowOptions {
    const {
        autoHideMenuBar,
        backgroundColor,
        compactMode,
        devTools,
        focusExistingWindow,
        minHeight,
        minWidth,
        reuseExistingWindow,
        windowHeight,
        windowTitle,
        windowWidth
    } = settings.store;

    return {
        autoHideMenuBar,
        backgroundColor,
        compactMode,
        customCss: compactMode ? getCompactConversationCss() : "",
        devTools,
        focusExistingWindow,
        height: clampInteger(windowHeight, 800, 320, 2160),
        minHeight: clampInteger(minHeight, 480, 320, 2160),
        minWidth: clampInteger(minWidth, 720, 320, 3840),
        reuseExistingWindow,
        title: windowTitle.trim() || "Discord",
        width: clampInteger(windowWidth, 1100, 320, 3840)
    };
}

function getPopupFeatures() {
    const { windowHeight, windowWidth } = settings.store;
    const width = clampInteger(windowWidth, 1100, 320, 3840);
    const height = clampInteger(windowHeight, 800, 320, 2160);

    return `popup,width=${width},height=${height}`;
}

function showOpenFailureToast() {
    if (settings.store.showFailureToast) showToast("Could not open the conversation window.", Toasts.Type.FAILURE);
}

async function openChannelWindow(channel: Channel) {
    const channelUrl = getChannelUrl(channel);

    if (settings.store.openNativeWindow && Native?.openConversationWindow) {
        const opened = await Native.openConversationWindow(channelUrl, channel.id, getWindowOptions());
        if (opened) return;
    }

    if (!settings.store.fallbackToPopup) {
        showOpenFailureToast();
        return;
    }

    const popup = window.open(
        channelUrl,
        `equicord-conversation-${channel.id}`,
        getPopupFeatures()
    );

    if (!popup) {
        showOpenFailureToast();
        return;
    }

    popup.focus();
}

function getChannelFromMiddleClick(event: MouseEvent) {
    if (!settings.store.enableMiddleClick || event.button !== middleClickButton) return null;

    const { target } = event;
    if (!(target instanceof HTMLElement)) return null;

    const channelId = getChannelIdFromElement(target);
    if (!channelId) return null;

    return ChannelStore.getChannel(channelId) ?? null;
}

function getChannelIdFromElement(target: HTMLElement) {
    const anchor = target.closest("a[href]");
    const href = anchor?.getAttribute("href");
    if (href) {
        const url = new URL(href, window.location.origin);
        const [, channelId] = /^\/channels\/(?:@me|\d+)\/(\d+)(?:\/\d+)?\/?$/.exec(url.pathname) ?? [];
        if (channelId) return channelId;
    }

    const channelRow = target.closest("[data-list-item-id^='channels___'], [id^='channels___']");
    const listItemId = channelRow?.getAttribute("data-list-item-id") ?? channelRow?.id;
    const channelId = listItemId?.match(/\d+/g)?.at(-1);

    return channelId ?? null;
}

function stopMiddleClick(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
}

function handleChannelMouseDown(event: MouseEvent) {
    const channel = getChannelFromMiddleClick(event);
    if (!channel) return;

    stopMiddleClick(event);
    void openChannelWindow(channel);
}

function handleChannelAuxClick(event: MouseEvent) {
    if (!getChannelFromMiddleClick(event)) return;

    stopMiddleClick(event);
}

function makeOpenWindowItem(channel: Channel) {
    return React.createElement(Menu.MenuItem, {
        id: "open-conversation-window",
        key: "open-conversation-window",
        label: "Open in New Window",
        action: () => openChannelWindow(channel)
    });
}

function addOpenWindowItem(children: Array<ReactElement | null>, channel: Channel, itemIds: string[], groupKey: string) {
    const group = findGroupChildrenByChildId(itemIds, children);
    const item = makeOpenWindowItem(channel);

    if (group) group.push(item);
    else children.splice(-1, 0, React.createElement(Menu.MenuGroup, { key: groupKey }, item));
}

const ChannelContext: NavContextMenuPatchCallback = (children, { channel, thread }: { channel?: Channel; thread?: Channel; }) => {
    if (!settings.store.showChannelContextMenu) return;

    const targetChannel = thread ?? channel;
    if (!targetChannel) return;

    addOpenWindowItem(children, targetChannel, ["channel-copy-link", "copy-link", "mark-channel-read"], "open-conversation-window-group");
};

const UserContext: NavContextMenuPatchCallback = (children, { channel }: { channel?: Channel; }) => {
    if (!settings.store.showUserContextMenu || !channel) return;

    addOpenWindowItem(children, channel, ["close-dm", "copy-user-id"], "open-conversation-window-group");
};

const MessageContext: NavContextMenuPatchCallback = (children, { message }: { message?: Message; }) => {
    if (!settings.store.showMessageContextMenu || !message) return;

    const channel = ChannelStore.getChannel(message.channel_id);
    if (!channel) return;

    addOpenWindowItem(children, channel, ["copy-link", "message-copy-link"], "open-conversation-window-message-group");
};

export default definePlugin({
    name: "ChannelWindows",
    description: "Open a channel in a separate window. Can be used for multi-calling.",
    tags: ["Organisation", "Voice", "Media", "Utility"],
    authors: [EquicordDevs.qdnx],
    dependencies: ["ContextMenuAPI"],
    settings,

    contextMenus: {
        "channel-context": ChannelContext,
        "channel-mention-context": ChannelContext,
        "thread-context": ChannelContext,
        "gdm-context": ChannelContext,
        "user-context": UserContext,
        "message": MessageContext
    },

    start() {
        window.addEventListener("mousedown", handleChannelMouseDown, true);
        window.addEventListener("auxclick", handleChannelAuxClick, true);
    },

    stop() {
        window.removeEventListener("mousedown", handleChannelMouseDown, true);
        window.removeEventListener("auxclick", handleChannelAuxClick, true);
    }
});
