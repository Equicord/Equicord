/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { copyWithToast, openUserProfile } from "@utils/discord";
import { useForceUpdater } from "@utils/react";
import { saveFile } from "@utils/web";
import { RenderModalProps, User } from "@vencord/discord-types";
import {
    Avatar,
    Button,
    Clickable,
    IconUtils,
    Modal,
    openModal,
    React,
    RelationshipStore,
    ScrollerThin,
    TextInput,
    Toasts,
    UserStore,
    useState
} from "@webpack/common";

import { cl, confirmDeleteEntry, fmt, nameHistoryData, removeEntry, settings } from ".";

export function openNameHistoryLogsModal() {
    return openModal(props => <NameHistoryLogsModal modalProps={props} />);
}

function GridIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
        </svg>
    );
}

function ListIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="8" y1="6" x2="21" y2="6" strokeLinecap="round" />
            <line x1="8" y1="12" x2="21" y2="12" strokeLinecap="round" />
            <line x1="8" y1="18" x2="21" y2="18" strokeLinecap="round" />
            <line x1="3" y1="6" x2="3.01" y2="6" strokeLinecap="round" strokeWidth="3" />
            <line x1="3" y1="12" x2="3.01" y2="12" strokeLinecap="round" strokeWidth="3" />
            <line x1="3" y1="18" x2="3.01" y2="18" strokeLinecap="round" strokeWidth="3" />
        </svg>
    );
}

function DownloadIcon() {
    return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

async function exportHistoryAsJson() {
    const entries = Object.entries(nameHistoryData).filter(([, r]) => r.history?.length);
    if (!entries.length) {
        Toasts.show({
            message: "No name history recorded to export",
            id: Toasts.genId(),
            type: Toasts.Type.FAILURE
        });
        return;
    }

    const users: Record<string, object> = {};
    for (const [userId, record] of entries) {
        const u = UserStore.getUser(userId);
        users[userId] = {
            username: u?.username ?? null,
            globalName: u?.globalName ?? null,
            currentName: u
                ? (u.globalName ? `${u.globalName} (@${u.username})` : `@${u.username}`)
                : (record.lastSeen ?? "Unknown User"),
            isFriend: RelationshipStore.isFriend(userId),
            lastSeen: record.lastSeen,
            history: record.history.map(h => ({
                name: h.name,
                timestamp: h.timestamp,
                date: fmt.format(h.timestamp)
            }))
        };
    }

    const payload = {
        exportedAt: new Date().toISOString(),
        totalUsers: entries.length,
        users
    };

    const json = JSON.stringify(payload, null, 2);
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `name-history-${dateStr}.json`;

    try {
        if (IS_DISCORD_DESKTOP) {
            const data = new TextEncoder().encode(json);
            await DiscordNative.fileManager.saveWithDialog(data, fileName);
        } else {
            saveFile(new File([json], fileName, { type: "application/json" }));
        }

        Toasts.show({
            message: `Exported ${entries.length} users with name changes to ${fileName}`,
            id: Toasts.genId(),
            type: Toasts.Type.SUCCESS
        });
    } catch {
        Toasts.show({
            message: "Failed to export JSON file",
            id: Toasts.genId(),
            type: Toasts.Type.FAILURE
        });
    }
}

export function NameHistoryLogsModal({ modalProps }: { modalProps: RenderModalProps; }) {
    const [search, setSearch] = useState("");
    const [viewMode, setViewMode] = useState<"list" | "grid">("list");
    const [filterFriends, setFilterFriends] = useState(settings.store.friendsOnly);
    const forceUpdate = useForceUpdater();

    const allEntries = Object.entries(nameHistoryData)
        .filter(([, data]) => (data.history?.length ?? 0) > 0)
        .map(([userId, data]) => {
            const user = UserStore.getUser(userId) as User | undefined;
            const isFriend = RelationshipStore.isFriend(userId);
            const currentName = user
                ? (user.globalName ? `${user.globalName} (@${user.username})` : `@${user.username}`)
                : (data.lastSeen || "Unknown User");
            return {
                userId,
                user,
                isFriend,
                currentName,
                data
            };
        });

    const friendsCount = allEntries.filter(e => e.isFriend).length;

    const filtered = allEntries
        .filter(item => {
            if (filterFriends && !item.isFriend) return false;
            if (!search.trim()) return true;
            const q = search.toLowerCase();
            return (
                item.currentName.toLowerCase().includes(q) ||
                item.userId.includes(q) ||
                item.data.history.some(h => h.name.toLowerCase().includes(q))
            );
        });

    return (
        <Modal
            {...modalProps}
            size="xl"
            title="Name History Logs"
        >
            <div className={cl("modal-body")}>
                <div className={cl("modal-toolbar")}>
                    <TextInput
                        placeholder="Search by name, @username, or ID..."
                        value={search}
                        onChange={setSearch}
                    />

                    <div className={cl("toolbar-actions")}>
                        <div className={cl("filter-tabs")}>
                            <button
                                className={cl("filter-tab", !filterFriends && "active")}
                                onClick={() => setFilterFriends(false)}
                            >
                                All ({allEntries.length})
                            </button>
                            <button
                                className={cl("filter-tab", filterFriends && "active")}
                                onClick={() => setFilterFriends(true)}
                            >
                                Friends ({friendsCount})
                            </button>
                        </div>

                        <div className={cl("view-toggle")}>
                            <button
                                className={cl("view-btn", viewMode === "list" && "active")}
                                onClick={() => setViewMode("list")}
                            >
                                <ListIcon />
                            </button>
                            <button
                                className={cl("view-btn", viewMode === "grid" && "active")}
                                onClick={() => setViewMode("grid")}
                            >
                                <GridIcon />
                            </button>
                        </div>
                    </div>
                </div>

                <ScrollerThin className={cl("modal-scroller")}>
                    {filtered.length === 0 ? (
                        <div className={cl("modal-empty")}>
                            {search.trim()
                                ? "No matching name logs found."
                                : filterFriends
                                    ? "No name changes recorded for friends yet."
                                    : "No name changes recorded yet."}
                        </div>
                    ) : viewMode === "grid" ? (
                        <div className={cl("grid-container")}>
                            {filtered.map(({ userId, user, isFriend, currentName, data }) => {
                                const avatarUrl = user?.getAvatarURL?.(undefined, 40) ?? IconUtils.getDefaultAvatarURL(userId);

                                return (
                                    <div key={userId} className={cl("grid-card")}>
                                        <div className={cl("grid-card-top")}>
                                            <Clickable
                                                className={cl("grid-card-user")}
                                                onClick={() => openUserProfile(userId)}
                                            >
                                                <Avatar
                                                    src={avatarUrl}
                                                    size="SIZE_40"
                                                    aria-label={currentName}
                                                />
                                                <div className={cl("log-user-names")}>
                                                    <div className={cl("log-name-row")}>
                                                        <span className={cl("log-user-current")}>{currentName}</span>
                                                        {isFriend && <span className={cl("friend-badge")}>Friend</span>}
                                                    </div>
                                                    <span className={cl("log-user-id")}>{userId}</span>
                                                </div>
                                            </Clickable>
                                        </div>

                                        <div className={cl("grid-history-container")}>
                                            <div className={cl("grid-history-label")}>Past Names ({data.history.length})</div>
                                            {data.history.slice().reverse().map(h => (
                                                <div key={h.timestamp} className={cl("grid-history-row")}>
                                                    <div
                                                        className={cl("log-history-left")}
                                                        onClick={() => copyWithToast(h.name, `Copied "${h.name}" to clipboard`)}
                                                    >
                                                        <span className={cl("log-prev-tag")}>PREV</span>
                                                        <span className={cl("log-prev-name")}>{h.name}</span>
                                                    </div>
                                                    <div className={cl("grid-row-right")}>
                                                        <span className={cl("log-prev-date")}>{fmt.format(h.timestamp)}</span>
                                                        <button
                                                            className={cl("tab-delete")}
                                                            onClick={() => {
                                                                confirmDeleteEntry(h.name, () => {
                                                                    removeEntry(userId, h.timestamp);
                                                                    forceUpdate();
                                                                });
                                                            }}
                                                        >
                                                            ×
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className={cl("list-container")}>
                            {filtered.map(({ userId, user, isFriend, currentName, data }) => {
                                const avatarUrl = user?.getAvatarURL?.(undefined, 32) ?? IconUtils.getDefaultAvatarURL(userId);

                                return (
                                    <div key={userId} className={cl("list-row")}>
                                        <Clickable
                                            className={cl("list-row-user")}
                                            onClick={() => openUserProfile(userId)}
                                        >
                                            <Avatar
                                                src={avatarUrl}
                                                size="SIZE_32"
                                                aria-label={currentName}
                                            />
                                            <span className={cl("list-row-name")}>{currentName}</span>
                                            {isFriend && <span className={cl("friend-badge")}>Friend</span>}
                                        </Clickable>

                                        <div className={cl("list-row-history")}>
                                            {data.history.slice().reverse().map(h => (
                                                <span key={h.timestamp} className={cl("list-prev-pill")}>
                                                    <span
                                                        className={cl("list-pill-content")}
                                                        onClick={() => copyWithToast(h.name, `Copied "${h.name}" to clipboard`)}
                                                    >
                                                        <span className={cl("log-prev-tag")}>PREV</span>
                                                        <span className={cl("list-pill-text")}>{h.name}</span>
                                                    </span>
                                                    <button
                                                        className={cl("pill-delete")}
                                                        onClick={() => {
                                                            confirmDeleteEntry(h.name, () => {
                                                                removeEntry(userId, h.timestamp);
                                                                forceUpdate();
                                                            });
                                                        }}
                                                    >
                                                        ×
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </ScrollerThin>

                <div className={cl("modal-footer")}>
                    <div className={cl("modal-footer-stats")}>
                        {allEntries.length} {allEntries.length === 1 ? "user" : "users"} with history
                    </div>
                    <Button
                        size={Button.Sizes.SMALL}
                        onClick={exportHistoryAsJson}
                        className={cl("export-btn")}
                    >
                        <DownloadIcon />
                        <span>Export as .json</span>
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
