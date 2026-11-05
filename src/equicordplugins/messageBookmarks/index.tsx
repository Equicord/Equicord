/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { ChatBarButton } from "@api/ChatButtons";
import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import * as DataStore from "@api/DataStore";
import { Button } from "@components/Button";
import ErrorBoundary from "@components/ErrorBoundary";
import { BookmarkIcon } from "@components/Icons";
import { Text } from "@components/Text";
import { EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { proxyLazy } from "@utils/lazy";
import definePlugin from "@utils/types";
import type { Message, RenderModalProps } from "@vencord/discord-types";
import { ChannelStore, Menu, MessageStore, Modal, moment, NavigationRouter, openModal, showToast, Tooltip, UserStore, zustandCreate } from "@webpack/common";

const cl = classNameFactory("vc-messagebookmarks-");

const DATA_KEY = "MessageBookmarks_bookmarks";

interface Bookmark {
    channelId: string;
    messageId: string;
    createdAt: number;
}

interface BookmarksState {
    bookmarks: Bookmark[];
    toggle: (channelId: string, messageId: string) => void;
    remove: (channelId: string, messageId: string) => void;
}

const useBookmarksStore = proxyLazy(() =>
    zustandCreate((set: (partial: Partial<BookmarksState>) => void, get: () => BookmarksState) => ({
        bookmarks: [],
        toggle(channelId, messageId) {
            const { bookmarks } = get();
            const exists = bookmarks.some(b => b.channelId === channelId && b.messageId === messageId);
            set({
                bookmarks: exists
                    ? bookmarks.filter(b => !(b.channelId === channelId && b.messageId === messageId))
                    : [{ channelId, messageId, createdAt: Date.now() }, ...bookmarks]
            });
            persist();
        },
        remove(channelId, messageId) {
            set({ bookmarks: get().bookmarks.filter(b => !(b.channelId === channelId && b.messageId === messageId)) });
            persist();
        }
    }))
);

function persist() {
    void DataStore.set(DATA_KEY, useBookmarksStore.getState().bookmarks);
}

function isBookmarked(channelId: string, messageId: string) {
    return useBookmarksStore.getState().bookmarks.some(b => b.channelId === channelId && b.messageId === messageId);
}

function toggleBookmark(message: Message) {
    const wasBookmarked = isBookmarked(message.channel_id, message.id);
    useBookmarksStore.getState().toggle(message.channel_id, message.id);
    showToast({ text: wasBookmarked ? "Bookmark removed" : "Bookmark added", variant: "success" });
}

function removeBookmark(message: Message) {
    useBookmarksStore.getState().remove(message.channel_id, message.id);
    showToast({ text: "Bookmark removed", variant: "success" });
}

function getChannelName(channelId: string) {
    const channel = ChannelStore.getChannel(channelId);
    if (!channel) return "Unknown channel";
    if (channel.isDM()) {
        const recipient = UserStore.getUser(channel.recipients[0]);
        return recipient?.username ?? "DM";
    }
    return channel.name || "Unknown channel";
}

function getSnippet(message: Message) {
    const content = message.content.replace(/\s+/g, " ").trim();
    return content.length > 150 ? `${content.slice(0, 150)}…` : content;
}

function jumpToBookmark(bookmark: Bookmark, onClose: () => void) {
    const channel = ChannelStore.getChannel(bookmark.channelId);
    NavigationRouter.transitionTo(`/channels/${channel?.guild_id ?? "@me"}/${bookmark.channelId}/${bookmark.messageId}`);
    onClose();
}

function openBookmarksModal() {
    openModal(modalProps => (
        <ErrorBoundary>
            <BookmarksModal modalProps={modalProps} />
        </ErrorBoundary>
    ));
}

function BookmarksModal({ modalProps }: { modalProps: RenderModalProps }) {
    const bookmarks = useBookmarksStore(s => s.bookmarks);

    return (
        <Modal {...modalProps} size="md" title="Message Bookmarks">
            <div className={cl("list")}>
                {bookmarks.length === 0 ? (
                    <Text size="md">No bookmarks yet. Hover a message and click the bookmark icon to save it.</Text>
                ) : (
                    bookmarks.map(bookmark => {
                        const message = MessageStore.getMessage(bookmark.channelId, bookmark.messageId);
                        return (
                            <div key={`${bookmark.channelId}-${bookmark.messageId}`} className={cl("row")}>
                                <div className={cl("row-info")}>
                                    <div className={cl("row-title")}>{getChannelName(bookmark.channelId)}</div>
                                    {message?.content && <div className={cl("row-content")}>{getSnippet(message)}</div>}
                                    <div className={cl("row-time")}>{moment(bookmark.createdAt).fromNow()}</div>
                                </div>
                                <Button size="small" onClick={() => jumpToBookmark(bookmark, modalProps.onClose)}>
                                    Jump
                                </Button>
                                <Button
                                    variant="dangerSecondary"
                                    size="small"
                                    onClick={() => useBookmarksStore.getState().remove(bookmark.channelId, bookmark.messageId)}
                                >
                                    Delete
                                </Button>
                            </div>
                        );
                    })
                )}
            </div>
        </Modal>
    );
}

const messageContextPatch: NavContextMenuPatchCallback = (children, { message }: { message?: Message }) => {
    if (!message) return;
    const bookmarked = isBookmarked(message.channel_id, message.id);
    children.push(
        <Menu.MenuItem
            id="vc-bookmark-message"
            label={bookmarked ? "Remove Bookmark" : "Bookmark"}
            icon={BookmarkIcon}
            leadingAccessory={{ type: "icon", icon: BookmarkIcon }}
            action={() => toggleBookmark(message)}
        />
    );
};

export default definePlugin({
    name: "MessageBookmarks",
    description: "Bookmark messages to save them for later and jump back to them anytime.",
    tags: ["Chat", "Utility"],
    authors: [EquicordDevs.__stack_chk_f__, EquicordDevs.Kernelstub],
    searchTerms: ["bookmark", "save", "later"],
    dependencies: ["ChatInputButtonAPI", "ContextMenuAPI", "MessageAccessoriesAPI", "MessagePopoverAPI"],

    async start() {
        const stored = await DataStore.get<Bookmark[]>(DATA_KEY);
        if (Array.isArray(stored)) useBookmarksStore.setState({ bookmarks: stored });
    },

    contextMenus: {
        message: messageContextPatch
    },

    chatBarButton: {
        icon: BookmarkIcon,
        render: () => (
            <ChatBarButton tooltip="Message Bookmarks" onClick={openBookmarksModal}>
                <BookmarkIcon />
            </ChatBarButton>
        )
    },

    messagePopoverButton: {
        icon: BookmarkIcon,
        render(message: Message) {
            const bookmarked = isBookmarked(message.channel_id, message.id);
            return {
                label: bookmarked ? "Remove Bookmark" : "Bookmark",
                icon: BookmarkIcon,
                ariaLabel: bookmarked ? "Remove Bookmark" : "Bookmark",
                onClick: () => toggleBookmark(message)
            };
        }
    },

    renderMessageAccessory: props => {
        const message = props.message as Message;
        const bookmarked = useBookmarksStore(s =>
            s.bookmarks.some((b: Bookmark) => b.channelId === message.channel_id && b.messageId === message.id)
        );
        if (!bookmarked) return null;
        return (
            <Tooltip text="Bookmarked. Click to remove">
                {({ onMouseEnter, onMouseLeave }) => (
                    <div
                        className={cl("accessory")}
                        role="button"
                        aria-label="Remove bookmark"
                        onMouseEnter={onMouseEnter}
                        onMouseLeave={onMouseLeave}
                        onClick={() => removeBookmark(message)}
                    >
                        <BookmarkIcon width={16} height={16} />
                    </div>
                )}
            </Tooltip>
        );
    }
});
