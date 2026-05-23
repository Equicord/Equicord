/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { HeaderBarButton } from "@api/HeaderBar";
import { addMessagePopoverButton, removeMessagePopoverButton } from "@api/MessagePopover";
import ErrorBoundary from "@components/ErrorBoundary";
import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { ChannelStore, Menu, openModal, React, showToast, Toasts } from "@webpack/common";

import { BookmarksModal } from "./BookmarksModal";
import { bookmarksCache, clearCache, getBookmarks, saveBookmarks } from "./store";
import type { Bookmark } from "./types";

function BookmarkIcon({ width = 20, height = 20, ...props }: { width?: number | string; height?: number | string; className?: string; [key: string]: any; }) {
    return (
        <svg width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
    );
}

function HeaderBarBookmarkButton() {
    return (
        <HeaderBarButton
            icon={BookmarkIcon}
            tooltip="Bookmarks"
            onClick={openBookmarksModal}
        />
    );
}

function BookmarkFilledIcon({ width = 20, height = 20, ...props }: { width?: number | string; height?: number | string; className?: string; [key: string]: any; }) {
    return (
        <svg width={width} height={height} viewBox="0 0 24 24" fill="currentColor" {...props}>
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
    );
}

function openBookmarksModal() {
    openModal(props => (
        <ErrorBoundary>
            <BookmarksModal modalProps={props} />
        </ErrorBoundary>
    ));
}

async function addBookmark(message: any) {
    const bookmarks = await getBookmarks();
    if (bookmarks.some(b => b.messageId === message.id)) return;

    const channel = ChannelStore.getChannel(message.channel_id);
    const bookmark: Bookmark = {
        id: `${message.id}_${Date.now()}`,
        messageId: message.id,
        channelId: message.channel_id,
        guildId: channel?.guild_id ?? null,
        authorId: message.author?.id ?? "",
        authorUsername: message.author?.globalName ?? message.author?.username ?? "Unknown",
        authorAvatar: message.author?.avatar ?? null,
        content: message.content ?? "",
        attachmentCount: message.attachments?.length ?? 0,
        timestamp: message.timestamp?.toString() ?? new Date().toISOString(),
        category: "general",
        savedAt: Date.now(),
    };

    bookmarks.push(bookmark);
    await saveBookmarks(bookmarks);
    showToast("✓ Bookmark saved", Toasts.Type.SUCCESS);
}

async function removeBookmark(messageId: string) {
    const bookmarks = await getBookmarks();
    await saveBookmarks(bookmarks.filter(b => b.messageId !== messageId));
    showToast("Bookmark removed", Toasts.Type.MESSAGE);
}

function renderBookmarkButton(message: any) {
    const isBookmarked = bookmarksCache?.some(b => b.messageId === message.id) ?? false;

    return {
        key: "mb-bookmark",
        label: isBookmarked
            ? "View Bookmarks"
            : "Add Bookmark",
        icon: isBookmarked ? BookmarkFilledIcon : BookmarkIcon,
        message,
        channel: ChannelStore.getChannel(message.channel_id),
        onClick: () => {
            if (isBookmarked) {
                openBookmarksModal();
            } else {
                addBookmark(message);
            }
        },
    };
}

const messageContextMenuPatch: NavContextMenuPatchCallback = (children, props) => {
    const { message } = props as { message: any; };
    if (!message?.id) return;

    const isBookmarked = bookmarksCache?.some(b => b.messageId === message.id) ?? false;

    children.push(
        <Menu.MenuItem
            key="mb-context-item"
            id="mb-context-item"
            label={isBookmarked
                ? "Remove Bookmark"
                : "Add Bookmark"}
            icon={isBookmarked ? BookmarkFilledIcon : BookmarkIcon}
            action={() => {
                if (isBookmarked) {
                    removeBookmark(message.id);
                } else {
                    addBookmark(message);
                }
            }}
        />
    );
};

export default definePlugin({
    name: "MessageBookmarks",
    description: "Save messages as private bookmarks and organize them in a beautiful panel with search",
    tags: ["Chat", "Utility"],
    authors: [EquicordDevs.LOSTSTR, EquicordDevs.NRaymond],
    dependencies: ["MessagePopoverAPI", "HeaderBarAPI"],
    headerBarButton: {
        icon: BookmarkIcon,
        render: HeaderBarBookmarkButton,
    },
    contextMenus: {
        message: messageContextMenuPatch,
    },

    start() {
        addMessagePopoverButton("MessageBookmarks", renderBookmarkButton, BookmarkIcon);
    },

    stop() {
        removeMessagePopoverButton("MessageBookmarks");
        clearCache();
    },
});
