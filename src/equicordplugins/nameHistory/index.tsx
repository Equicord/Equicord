/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { get, set } from "@api/DataStore";
import { HeaderBarButton } from "@api/HeaderBar";
import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { copyWithToast } from "@utils/discord";
import definePlugin, { OptionType } from "@utils/types";
import { User } from "@vencord/discord-types";
import { Alerts, Button, React, RelationshipStore, UserStore, useState } from "@webpack/common";

import { openNameHistoryLogsModal } from "./NameHistoryLogsModal";

export const cl = classNameFactory("vc-name-history-");

export const settings = definePluginSettings({
    friendsOnly: {
        type: OptionType.BOOLEAN,
        description: "Only track and display name history for friends",
        default: false,
    },
});

const DATA_KEY = "NameHistory_data";

export interface NameEntry {
    name: string;
    timestamp: number;
}

export interface UserRecord {
    lastSeen?: string;
    history: NameEntry[];
}

export let nameHistoryData: Record<string, UserRecord> = {};

export const fmt = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
});

function normalizeData(raw: Record<string, unknown>): Record<string, UserRecord> {
    const res: Record<string, UserRecord> = {};
    for (const [id, val] of Object.entries(raw)) {
        if (Array.isArray(val)) {
            const history = val.filter((e): e is NameEntry => Boolean(e && typeof e.name === "string" && typeof e.timestamp === "number"));
            res[id] = {
                lastSeen: history.at(-1)?.name,
                history
            };
        } else if (val && typeof val === "object") {
            const obj = val as { lastSeen?: unknown; history?: unknown; };
            const history = Array.isArray(obj.history)
                ? obj.history.filter((e): e is NameEntry => Boolean(e && typeof e.name === "string" && typeof e.timestamp === "number"))
                : [];
            res[id] = {
                lastSeen: typeof obj.lastSeen === "string" ? obj.lastSeen : undefined,
                history
            };
        }
    }
    return res;
}

async function save() {
    await set(DATA_KEY, nameHistoryData);
}

export function getHistory(userId: string): NameEntry[] {
    return nameHistoryData[userId]?.history ?? [];
}

export function removeEntry(userId: string, timestamp: number) {
    const record = nameHistoryData[userId];
    if (!record) return;
    record.history = record.history.filter(e => e.timestamp !== timestamp);
    if (!record.history.length && !record.lastSeen) {
        delete nameHistoryData[userId];
    }
    save();
}

export function confirmDeleteEntry(name: string, onConfirm: () => void) {
    Alerts.show({
        title: "Delete Name History Entry",
        body: `Are you sure you want to delete "${name}" from name history?`,
        confirmText: "Delete",
        cancelText: "Cancel",
        confirmColor: Button.Colors.RED,
        onConfirm
    });
}

function formatName(user: { username: string; globalName?: string | null; }) {
    return user.globalName ? `${user.globalName} (@${user.username})` : `@${user.username}`;
}

export function checkUser(user?: { id?: string; username?: string; globalName?: string | null; }) {
    if (!user?.id || !user.username) return;
    if (settings.store.friendsOnly && !RelationshipStore.isFriend(user.id)) return;

    const currentName = formatName(user);
    const record = nameHistoryData[user.id] ??= {
        lastSeen: currentName,
        history: []
    };

    if (!record.lastSeen) {
        record.lastSeen = currentName;
        save();
        return;
    }

    if (record.lastSeen !== currentName) {
        const oldName = record.lastSeen;
        record.lastSeen = currentName;
        const lastEntry = record.history.at(-1);
        if (!lastEntry || lastEntry.name !== oldName) {
            record.history.push({ name: oldName, timestamp: Date.now() });
            if (record.history.length > 25) {
                record.history.splice(0, record.history.length - 25);
            }
        }
        save();
    }
}

function scanUsers() {
    const users = UserStore.getUsers?.();
    if (!users) return;
    for (const id in users) {
        checkUser(users[id]);
    }
}

function Popout({ user }: { user: User; }) {
    if (settings.store.friendsOnly && !RelationshipStore.isFriend(user?.id)) return null;
    if (user) checkUser(user);
    const history = getHistory(user?.id);
    if (!history.length) return null;

    return (
        <div className={cl("section")}>
            <div className={cl("label")}>Previously known as</div>
            {[...history].reverse().map((e, i) => (
                <div key={i} className={cl("entry")}>
                    <span className={cl("name")}>{e.name}</span>
                    <span className={cl("date")}>{fmt.format(e.timestamp)}</span>
                </div>
            ))}
        </div>
    );
}

function HistoryIcon({ height = 20, width = 20 }: { height?: number; width?: number; }) {
    return (
        <svg width={width} height={height} viewBox="0 0 24 24" fill="none">
            <path d="M12 8v4l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        </svg>
    );
}

function NameHistoryHeaderButton() {
    return (
        <HeaderBarButton
            className={cl("toolbar-btn")}
            onClick={() => openNameHistoryLogsModal()}
            tooltip="Name History Logs"
            icon={HistoryIcon}
        />
    );
}

function NameHistoryTab({ userId }: { userId: string; }) {
    const [, update] = useState(0);
    const u = UserStore.getUser(userId);
    if (u) checkUser(u);
    const history = getHistory(userId);

    if (!history?.length) {
        const currentName = u ? (u.globalName ? `${u.globalName} (@${u.username})` : `@${u.username}`) : undefined;
        return (
            <div className={cl("tab-empty")}>
                <div>No previous name changes recorded yet.</div>
                {currentName && (
                    <div
                        className={cl("tab-current")}
                        onClick={() => copyWithToast(currentName, `Copied "${currentName}" to clipboard`)}
                        title="Click to copy name"
                    >
                        Current: {currentName}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className={cl("tab")}>
            {[...history].reverse().map(entry => (
                <div key={entry.timestamp} className={cl("tab-entry")}>
                    <div
                        className={cl("tab-info")}
                        onClick={() => copyWithToast(entry.name, `Copied "${entry.name}" to clipboard`)}
                        title="Click to copy name"
                    >
                        <span className={cl("tab-name")}>{entry.name}</span>
                        <span className={cl("tab-date")}>{fmt.format(entry.timestamp)}</span>
                    </div>
                    <button
                        className={cl("tab-delete")}
                        onClick={() => {
                            confirmDeleteEntry(entry.name, () => {
                                removeEntry(userId, entry.timestamp);
                                update(n => n + 1);
                            });
                        }}
                        title="Remove entry"
                    >
                        ×
                    </button>
                </div>
            ))}
        </div>
    );
}

export default definePlugin({
    name: "NameHistory",
    description: "Locally saves username and display name changes, showing them on user profiles.",
    authors: [EquicordDevs.snea1337],
    tags: ["Users", "Profiles"],
    dependencies: ["ProfileCollectionsAPI", "HeaderBarAPI"],
    settings,
    enabledByDefault: true,

    headerBarButton: {
        render: () => <NameHistoryHeaderButton />,
        icon: HistoryIcon,
        priority: 0,
    },

    patches: [
        {
            find: "#{intl::USER_PROFILE_ACTIVITY}",
            replacement: {
                match: /(\i)\.id!==\i\?\.id&&\i&&\(.{0,300}\.MUTUAL_GUILDS\}\)\)(?=,(\i))/,
                replace: "$&,$2.push({text:\"Name History\",section:\"NAME_HISTORY\"})",
            }
        },
        {
            find: ".WIDGETS?",
            replacement: {
                match: /(\i)===\i\.\i\.WISHLIST/,
                replace: "$1===\"NAME_HISTORY\"?$self.renderTab(arguments[0]):$&",
            }
        }
    ],

    renderProfileCollection: {
        render: (props: { user: User; }) => <Popout user={props.user} />,
        priority: 0,
    },

    async start() {
        const raw = await get<Record<string, unknown>>(DATA_KEY);
        if (raw && typeof raw === "object") nameHistoryData = normalizeData(raw);

        scanUsers();
        UserStore.addChangeListener(scanUsers);
    },

    stop() {
        UserStore.removeChangeListener(scanUsers);
    },

    flux: {
        USER_UPDATE({ user }: { user: { id: string; username: string; globalName?: string | null; }; }) {
            checkUser(user);
        },
        GUILD_MEMBER_UPDATE(event: { user?: { id: string; username: string; globalName?: string | null; }; }) {
            checkUser(event?.user);
        },
        USER_PROFILE_FETCH_SUCCESS(event: { user?: User; userProfile?: { user?: User; }; }) {
            checkUser(event?.userProfile?.user ?? event?.user);
        },
        RELATIONSHIP_ADD(event: { user?: User; relationship?: { user?: User; }; }) {
            checkUser(event?.relationship?.user ?? event?.user);
        },
        RELATIONSHIP_UPDATE(event: { user?: User; relationship?: { user?: User; }; }) {
            checkUser(event?.relationship?.user ?? event?.user);
        },
        async CONNECTION_OPEN() {
            const raw = await get<Record<string, unknown>>(DATA_KEY);
            if (raw && typeof raw === "object") nameHistoryData = normalizeData(raw);
            scanUsers();
        }
    },

    hasHistory(userId: string) {
        const u = UserStore.getUser(userId);
        if (u) checkUser(u);
        return (nameHistoryData[userId]?.history?.length ?? 0) > 0;
    },

    renderTab: ErrorBoundary.wrap((props: { user: User; }) => {
        if (settings.store.friendsOnly && !RelationshipStore.isFriend(props.user?.id)) {
            return <div className={cl("tab-empty")}>Name history is set to friends only.</div>;
        }
        return <NameHistoryTab userId={props.user?.id} />;
    }, { noop: true }),
});
