/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { HeaderBarButton } from "@api/HeaderBar";
import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import definePlugin, { OptionType } from "@utils/types";
import { Channel } from "@vencord/discord-types";
import { findComponentByCodeLazy } from "@webpack";
import { ChannelActionCreators, ChannelStore, Menu, MessageActions, MessageStore, PermissionsBits, PermissionStore, PopoutActions, PopoutWindowStore, RelationshipStore, SelectedChannelStore, useEffect, UserStore, useStateFromStores } from "@webpack/common";
import type { SVGProps } from "react";

import managedStyle from "./styles.css?managed";

const cl = classNameFactory("vc-minichat-");

const PopoutWindow = findComponentByCodeLazy("Missing guestWindow reference");
const FullChannelView = findComponentByCodeLazy(/showFollowButton:\i\?\.type===/);

const WINDOW_PREFIX = "DISCORD_MC_";

const settings = definePluginSettings({
    persistWindowsOnRestart: {
        type: OptionType.BOOLEAN,
        description: "Restore open MiniChat windows after Discord restarts.",
        default: true,
        onChange: value => {
            if (!value) {
                settings.store.persistedWindowIds = [];
                return;
            }

            syncPersistedOpenWindows();
        }
    },
    persistedWindowIds: {
        type: OptionType.CUSTOM,
        description: "Persisted MiniChat window channel IDs.",
        default: [] as string[],
        hidden: true
    },
    alwaysOnTop: {
        type: OptionType.BOOLEAN,
        description: "Keep chat windows above all others.",
        default: true,
        onChange: value => {
            for (const windowKey of getOpenWindowKeys()) {
                PopoutActions.setAlwaysOnTop(windowKey, value);
            }
        }
    }
});

function getWindowKey(channelId: string) {
    return `${WINDOW_PREFIX}${channelId}`;
}

function getOpenWindowKeys() {
    return PopoutWindowStore.getWindowKeys().filter(key => key.startsWith(WINDOW_PREFIX));
}

function getPersistedChannelIds() {
    return settings.store.persistedWindowIds ?? [];
}

function isMiniChatOpen(channelId: string) {
    return PopoutWindowStore.getWindowOpen(getWindowKey(channelId));
}

function getOpenMiniChatChannelIds() {
    return getOpenWindowKeys().map(key => key.slice(WINDOW_PREFIX.length));
}

function syncPersistedOpenWindows() {
    if (!settings.store.persistWindowsOnRestart) {
        settings.store.persistedWindowIds = [];
        return;
    }

    settings.store.persistedWindowIds = getOpenMiniChatChannelIds();
}

function getChannelTitle(channel: Channel | null | undefined) {
    if (!channel) return "Chat";

    if (channel.isPrivate()) {
        const recipientId = channel.getRecipientId?.();
        if (!channel.name && recipientId) {
            const user = UserStore.getUser(recipientId);
            if (user) {
                return RelationshipStore.getNickname(recipientId) || user.globalName || user.username || "DM";
            }
        }

        return channel.name || "DM";
    }

    return channel.name || "Chat";
}

function canOpenInMiniChat(channel: Channel) {
    if (channel.isPrivate()) return true;
    return !channel.isCategory() && !channel.isDirectory() && !channel.isVocal();
}

async function waitForDmChannel(userId: string, timeoutMs = 2500) {
    const startedAt = Date.now();
    while (Date.now() - startedAt <= timeoutMs) {
        const channelId = ChannelStore.getDMFromUserId?.(userId);
        if (channelId) return channelId;

        await new Promise(resolve => setTimeout(resolve, 80));
    }

    return null;
}

async function openMiniChatFromUserMenu(userId: string) {
    try {
        const channelId = await Promise.resolve(ChannelActionCreators.getOrEnsurePrivateChannel(userId));
        if (channelId) openMiniChat(channelId);
        return;
    } catch {
        const fallbackChannelId = await waitForDmChannel(userId);
        if (fallbackChannelId) openMiniChat(fallbackChannelId);
    }
}

function getMenuLabel(channelId: string) {
    return isMiniChatOpen(channelId) ? "Close popout chat" : "Popout chat";
}

function createMiniChatContextMenuItem(id: string, label: string, action: () => void | Promise<void>) {
    return (
        <Menu.MenuItem
            id={`vc-mini-chat-${id}`}
            label={label}
            action={() => { void action(); }}
        />
    );
}

const UserContextPatch: NavContextMenuPatchCallback = (children, args: { user: { id: string; }; }) => {
    if (!args.user || args.user.id === UserStore.getCurrentUser().id) return;
    const existingChannelId = ChannelStore.getDMFromUserId?.(args.user.id) ?? null;
    const isOpen = existingChannelId ? isMiniChatOpen(existingChannelId) : false;

    children.push(createMiniChatContextMenuItem(
        args.user.id,
        isOpen ? "Close popout chat" : "Popout chat",
        () => {
            if (existingChannelId && isOpen) {
                closeMiniChat(existingChannelId);
                return;
            }

            return openMiniChatFromUserMenu(args.user.id);
        }
    ));
};

const ChannelContextPatch: NavContextMenuPatchCallback = (children, args: { channel: Channel; }) => {
    if (!args.channel || args.channel.isCategory()) return;
    if (args.channel.isPrivate() || PermissionStore.can(PermissionsBits.VIEW_CHANNEL, args.channel)) {
        children.push(createMiniChatContextMenuItem(args.channel.id, getMenuLabel(args.channel.id), () => openMiniChat(args.channel.id)));
    }
};

function MiniChatContent({ channel }: { channel: Channel; }) {
    useEffect(() => {
        if (!channel?.id || MessageStore.getLastMessage(channel.id)) return;

        MessageActions.fetchMessages({
            channelId: channel.id,
            limit: 50
        });
    }, [channel?.id]);

    if (!FullChannelView) return null;

    return (
        <div className={cl("window")}>
            <FullChannelView providedChannel={channel} />
        </div>
    );
}

const WrappedMiniChatContent = ErrorBoundary.wrap(MiniChatContent, { noop: true });

function closeMiniChat(channelId: string) {
    const windowKey = getWindowKey(channelId);
    PopoutActions.close(windowKey);
    syncPersistedOpenWindows();
}

function openMiniChat(channelId: string) {
    const channel = ChannelStore.getChannel(channelId);
    if (!channel || !canOpenInMiniChat(channel)) return;

    const windowKey = getWindowKey(channelId);

    if (isMiniChatOpen(channelId)) {
        closeMiniChat(channelId);
        return;
    }

    const title = getChannelTitle(channel);

    PopoutActions.open(
        windowKey,
        () => (
            <PopoutWindow
                withTitleBar
                windowKey={windowKey}
                title={title}
                channelId={channelId}
                contentClassName={cl("popout")}
            >
                <WrappedMiniChatContent channel={channel} />
            </PopoutWindow>
        ),
        { width: 500, height: 450 }
    );

    PopoutActions.setAlwaysOnTop(windowKey, settings.store.alwaysOnTop);
    syncPersistedOpenWindows();
}

function MiniChatButton() {
    const channelState = useStateFromStores(
        [SelectedChannelStore, ChannelStore, PopoutWindowStore],
        () => {
            const channelId = SelectedChannelStore.getChannelId();
            const channel = channelId ? ChannelStore.getChannel(channelId) : null;

            return {
                channel,
                isOpen: channel ? PopoutWindowStore.getWindowOpen(getWindowKey(channel.id)) : false,
                label: getChannelTitle(channel)
            };
        },
        []
    );

    if (!channelState.channel) return null;

    const { channel, isOpen, label } = channelState;

    return (
        <HeaderBarButton
            key={`${channel.id}-${isOpen ? "open" : "closed"}`}
            icon={isOpen ? CloseIcon : MiniIcon}
            tooltip={isOpen ? "Close popout chat" : `Open MiniChat for ${label}`}
            aria-label="MiniChat"
            selected={isOpen}
            onClick={() => (isOpen ? closeMiniChat(channel.id) : openMiniChat(channel.id))}
        />
    );
}

const WrappedMiniChatButton = ErrorBoundary.wrap(MiniChatButton, { noop: true });

function MiniIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg width={24} height={24} viewBox="0 0 24 24" fill="currentColor" {...props}>
            <path d="M15 2a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0V4.41l-4.3 4.3a1 1 0 1 1-1.4-1.42L19.58 3H16a1 1 0 0 1-1-1Z" />
            <path d="M5 2a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3v-6a1 1 0 1 0-2 0v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h6a1 1 0 1 0 0-2H5Z" />
        </svg>
    );
}

function CloseIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg width={24} height={24} viewBox="0 0 24 24" fill="currentColor" {...props}>
            <path d="M17.3 18.7a1 1 0 0 0 1.4-1.4L13.42 12l5.3-5.3a1 1 0 0 0-1.42-1.4L12 10.58l-5.3-5.3a1 1 0 0 0-1.4 1.42L10.58 12l-5.3 5.3a1 1 0 1 0 1.42 1.4L12 13.42l5.3 5.3Z" />
        </svg>
    );
}

export default definePlugin({
    name: "MiniChat",
    description: "Pop out any chat into a small Always on Top window.",
    tags: ["Chat", "Appearance", "Servers"],
    authors: [
        EquicordDevs.justjxke,
        { name: "Snues", id: 98862725609816064n }
    ],
    dependencies: ["HeaderBarAPI"],
    settings,
    managedStyle,
    contextMenus: {
        "user-context": UserContextPatch,
        "channel-context": ChannelContextPatch,
        "thread-context": ChannelContextPatch,
        "gdm-context": ChannelContextPatch
    },
    headerBarButton: {
        icon: MiniIcon,
        render: () => <WrappedMiniChatButton />
    },
    stop() {
        syncPersistedOpenWindows();
        for (const windowKey of getOpenWindowKeys()) {
            PopoutActions.close(windowKey);
        }
    },
    async start() {
        if (!settings.store.persistWindowsOnRestart) return;

        for (const channelId of getPersistedChannelIds()) {
            const channel = ChannelStore.getChannel(channelId);
            if (!channel || !canOpenInMiniChat(channel)) continue;

            openMiniChat(channelId);
        }
    }
});
