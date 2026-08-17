/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";
import { showNotification } from "@api/Notifications";
import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { Message } from "@vencord/discord-types";
import { findByPropsLazy } from "@webpack";
import { Menu, NavigationRouter, UserStore } from "@webpack/common";

const jumper = findByPropsLazy<{
    jumpToMessage: (opts: { channelId: string; messageId: string; flash?: boolean }) => void;
}>("jumpToMessage");

interface Reminder {
    msgId: string;
    chanId: string;
    guildId?: string;
    time: number;
}

const BASE_STORAGE_KEY = "MessageFollowUp_reminders_";

const DURATIONS = [
    { id: "30s", label: "In 30 Seconds", ms: 30 * 1000 },
    { id: "5m", label: "In 5 Minutes", ms: 5 * 60 * 1000 },
    { id: "15m", label: "In 15 Minutes", ms: 15 * 60 * 1000 },
    { id: "30m", label: "In 30 Minutes", ms: 30 * 60 * 1000 },
    { id: "1h", label: "In 1 Hour", ms: 60 * 60 * 1000 },
    { id: "3h", label: "In 3 Hours", ms: 3 * 60 * 60 * 1000 },
    { id: "6h", label: "In 6 Hours", ms: 6 * 60 * 60 * 1000 },
    { id: "12h", label: "In 12 Hours", ms: 12 * 60 * 60 * 1000 },
    { id: "tomorrow", label: "Tomorrow", ms: 24 * 60 * 60 * 1000 },
    { id: "3d", label: "In 3 Days", ms: 3 * 24 * 60 * 60 * 1000 },
    { id: "1w", label: "In 1 Week", ms: 7 * 24 * 60 * 60 * 1000 }
];

let reminders: Reminder[] = [];
let checkInterval: NodeJS.Timeout;

// Tracking state variables for account management & async handling
let loadedUserId: string | null = null;
let loadingUserId: string | null = null;
let loadPromise: Promise<void> | null = null;
let loadGeneration = 0;

function getStorageKey(userId: string) {
    return `${BASE_STORAGE_KEY}${userId}`;
}

function getCurrentUserId(): string | null {
    return UserStore.getCurrentUser()?.id ?? null;
}

async function loadReminders(): Promise<void> {
    const userId = getCurrentUserId();

    if (!userId) {
        reminders = [];
        loadedUserId = null;
        loadingUserId = null;
        return;
    }

    // Already loaded for this user
    if (loadedUserId === userId) return;

    // Reuse existing loading promise if we're currently fetching for the exact same user
    if (loadPromise && loadingUserId === userId) {
        await loadPromise;
        return;
    }

    const currentGen = ++loadGeneration;
    loadingUserId = userId;

    loadPromise = (async () => {
        try {
            const data = await DataStore.get<Reminder[]>(getStorageKey(userId));

            // Only commit the data if we're still on the exact same load attempt and user
            if (currentGen === loadGeneration && getCurrentUserId() === userId) {
                reminders = data ?? [];
                loadedUserId = userId;
            }
        } catch (err) {
            console.error("[MessageFollowUp] Failed to load reminders from DataStore:", err);
            if (currentGen === loadGeneration && getCurrentUserId() === userId) {
                reminders = [];
            }
        } finally {
            if (currentGen === loadGeneration) {
                loadingUserId = null;
                loadPromise = null;
            }
        }
    })();

    await loadPromise;
}

async function saveReminders(userId: string): Promise<void> {
    try {
        const snapshot = [...reminders];
        await DataStore.set(getStorageKey(userId), snapshot);
    } catch (err) {
        console.error("[MessageFollowUp] Failed to save reminders:", err);
    }
}

async function addReminder(msg: Message, ms: number) {
    const userId = getCurrentUserId();
    if (!userId) return;

    await loadReminders();

    // Verify context is still valid post-async operation
    if (getCurrentUserId() !== userId || loadedUserId !== userId) return;

    reminders.push({
        msgId: msg.id,
        chanId: msg.channel_id,
        guildId: msg.guild_id,
        time: Date.now() + ms
    });

    await saveReminders(userId);

    showNotification({
        title: "Reminder Set",
        body: "Will remind you about this message."
    });
}

async function checkReminders() {
    const userId = getCurrentUserId();
    if (!userId) return;

    await loadReminders();

    if (loadedUserId !== userId || !reminders.length) return;

    const now = Date.now();
    const due = reminders.filter(r => r.time <= now);

    if (!due.length) return;

    for (const r of due) {
        showNotification({
            title: "Message Follow Up",
            body: "Click to jump back to the message",
            dismissOnClick: true,
            onClick: () => {
                const path = r.guildId
                    ? `/channels/${r.guildId}/${r.chanId}`
                    : `/channels/@me/${r.chanId}`;

                NavigationRouter.transitionTo(path);

                setTimeout(() => {
                    jumper?.jumpToMessage({
                        channelId: r.chanId,
                        messageId: r.msgId,
                        flash: true
                    });
                }, 300);
            }
        });
    }

    reminders = reminders.filter(r => r.time > now);
    await saveReminders(userId);
}

export default definePlugin({
    name: "MessageFollowUp",
    description: "Set reminders for Discord messages and jump back to them later.",
    authors: [EquicordDevs.noxify],

    contextMenus: {
        "message"(children, { message }: { message: Message }) {
            if (!message) return;

            children.push(
                <Menu.MenuItem id="message-follow-up" label="Follow Up">
                    {DURATIONS.map(({ id, label, ms }) => (
                        <Menu.MenuItem
                            key={id}
                            id={`message-follow-up-${id}`}
                            label={label}
                            action={() => void addReminder(message, ms)}
                        />
                    ))}
                </Menu.MenuItem>
            );
        }
    },

    flux: {
        CONNECTION_OPEN() {
            reminders = [];
            loadedUserId = null;
            loadingUserId = null;
            loadPromise = null;
            loadGeneration++;

            void loadReminders();
        }
    },

    async start() {
        await loadReminders();
        await checkReminders();
        checkInterval = setInterval(() => void checkReminders(), 30000);
    },

    stop() {
        clearInterval(checkInterval);

        reminders = [];
        loadedUserId = null;
        loadingUserId = null;
        loadPromise = null;
        loadGeneration++;
    }
});
