/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findByPropsLazy } from "@webpack";
import { ChannelStore, GuildStore, Modal, React, useEffect, useState } from "@webpack/common";

import { getBookmarks, saveBookmarks } from "./store";
import type { Bookmark, BookmarkCategory } from "./types";

const jumper = findByPropsLazy("jumpToMessage");

const NEXT_CATEGORY: Record<BookmarkCategory, BookmarkCategory> = {
    general: "important",
    important: "later",
    later: "general",
};

function categoryLabel(cat: BookmarkCategory): string {
    if (cat === "important") return "Important";
    if (cat === "later") return "Later";
    return "General";
}

function avatarUrl(authorId: string, avatar: string | null | undefined): string {
    if (!avatar) {
        const index = Number(BigInt(authorId) >> 22n) % 6;
        return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
    }
    const ext = avatar.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${authorId}/${avatar}.${ext}?size=32`;
}

function relativeTime(savedAt: number): string {
    const min = Math.floor((Date.now() - savedAt) / 60000);
    if (min < 1) return "just now";
    if (min < 60) return `${min}m ago`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
}

export function BookmarksModal({ modalProps }: { modalProps: any; }) {
    const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
    const [search, setSearch] = useState("");
    const [activeTab, setActiveTab] = useState<BookmarkCategory | "all">("all");

    useEffect(() => {
        getBookmarks().then(setBookmarks);
    }, []);

    const filtered = bookmarks.filter(b => {
        if (activeTab !== "all" && b.category !== activeTab) return false;
        if (search) {
            const q = search.toLowerCase();
            return b.content.toLowerCase().includes(q) || b.authorUsername.toLowerCase().includes(q);
        }
        return true;
    });

    async function handleDelete(id: string) {
        const updated = bookmarks.filter(b => b.id !== id);
        await saveBookmarks(updated);
        setBookmarks(updated);
    }

    async function handleCycleCategory(id: string) {
        const updated = bookmarks.map(b =>
            b.id === id ? { ...b, category: NEXT_CATEGORY[b.category] } : b
        );
        await saveBookmarks(updated);
        setBookmarks(updated);
    }

    function handleJump(bookmark: Bookmark) {
        modalProps.onClose();
        jumper.jumpToMessage({
            channelId: bookmark.channelId,
            messageId: bookmark.messageId,
            flash: true,
            jumpType: "INSTANT",
        });
    }

    const counts = {
        all: bookmarks.length,
        important: bookmarks.filter(b => b.category === "important").length,
        later: bookmarks.filter(b => b.category === "later").length,
    };

    return (
        <Modal
            {...modalProps}
            size="lg"
            title={`Bookmarks (${bookmarks.length})`}
        >
            <div className="mb-body">
                <div className="mb-search-wrap">
                    <svg className="mb-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                    </svg>
                    <input
                        className="mb-search"
                        type="text"
                        placeholder="Search bookmarks..."
                        value={search}
                        onChange={e => setSearch((e.target as HTMLInputElement).value)}
                    />
                    {search && (
                        <button className="mb-search-clear" onClick={() => setSearch("")}>×</button>
                    )}
                </div>

                <div className="mb-tabs">
                    {(["all", "important", "later"] as const).map(tab => (
                        <button
                            key={tab}
                            className={`mb-tab${activeTab === tab ? " mb-tab-active" : ""}`}
                            onClick={() => setActiveTab(tab)}
                        >
                            {tab === "all" && `All (${counts.all})`}
                            {tab === "important" && `📌 Important (${counts.important})`}
                            {tab === "later" && `🕐 Later (${counts.later})`}
                        </button>
                    ))}
                </div>

                <div className="mb-list">
                    {filtered.length === 0 ? (
                        <div className="mb-empty">
                            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                            </svg>
                            <p className="mb-empty-title">
                                {search
                                    ? "No results found"
                                    : "No bookmarks yet"}
                            </p>
                            {!search && (
                                <span className="mb-empty-hint">
                                    Right-click any message and choose &quot;Add to Bookmarks&quot;
                                </span>
                            )}
                        </div>
                    ) : (
                        filtered.map(bookmark => {
                            const channel = ChannelStore.getChannel(bookmark.channelId);
                            const channelName = channel?.name ?? bookmark.channelId;
                            const guild = bookmark.guildId ? GuildStore.getGuild(bookmark.guildId) : null;
                            const location = guild
                                ? `${guild.name} › #${channelName}`
                                : `#${channelName}`;

                            return (
                                <div key={bookmark.id} className={`mb-item mb-item-${bookmark.category}`}>
                                    <div className="mb-item-header">
                                        {bookmark.authorId && (
                                            <img
                                                className="mb-avatar"
                                                src={avatarUrl(bookmark.authorId, bookmark.authorAvatar)}
                                                alt=""
                                            />
                                        )}
                                        <div className="mb-item-meta">
                                            <span className="mb-author">{bookmark.authorUsername}</span>
                                            <span className="mb-location">{location}</span>
                                        </div>
                                        <span className="mb-time">{relativeTime(bookmark.savedAt)}</span>
                                    </div>

                                    {(bookmark.content || bookmark.attachmentCount > 0) && (
                                        <div className="mb-content">
                                            {bookmark.content
                                                ? bookmark.content.slice(0, 160) + (bookmark.content.length > 160 ? "…" : "")
                                                : "Attachment"}
                                            {bookmark.content && bookmark.attachmentCount > 0 && " 📎"}
                                        </div>
                                    )}

                                    <div className="mb-item-actions">
                                        <button
                                            className={`mb-category-badge mb-cat-${bookmark.category}`}
                                            title="Click to change category"
                                            onClick={() => handleCycleCategory(bookmark.id)}
                                        >
                                            {categoryLabel(bookmark.category)}
                                        </button>
                                        <div className="mb-item-right">
                                            <button
                                                className="mb-action mb-jump"
                                                title="Jump to message"
                                                onClick={() => handleJump(bookmark)}
                                            >
                                                ↗ Jump
                                            </button>
                                            <button
                                                className="mb-action mb-delete"
                                                title="Delete"
                                                onClick={() => handleDelete(bookmark.id)}
                                            >
                                                🗑
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </Modal>
    );
}
