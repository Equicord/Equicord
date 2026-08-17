/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";
import { showNotification } from "@api/Notifications";
import definePlugin from "@utils/types";
import { Message } from "@vencord/discord-types";
import { findByPropsLazy } from "@webpack";
import { Menu, NavigationRouter } from "@webpack/common";

const jumper: any = findByPropsLazy("jumpToMessage");

interface Reminder {
    msgId: string;
    chanId: string;
    guildId?: string;
    text: string;
    time: number;
}

const STORAGE_KEY = "MessageFollowUp_reminders";

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

async function loadReminders() {
    reminders = await DataStore.get<Reminder[]>(STORAGE_KEY) ?? [];
}

async function saveReminders() {
    await DataStore.set(STORAGE_KEY, reminders);
}

async function addReminder(msg: Message, ms: number) {
    reminders.push({
        msgId: msg.id,
        chanId: msg.channel_id,
        guildId: msg.guild_id,
        text: msg.content || "Message reminder",
        time: Date.now() + ms
    });

    await saveReminders();

    showNotification({
        title: "Reminder Set",
        body: "Will remind you about this message."
    });
}

async function checkReminders() {
    const now = Date.now();
    const due = reminders.filter(r => r.time <= now);

    if (!due.length) return;

    for (const r of due) {
        showNotification({
    title: "Message Follow Up",
    body: r.text.length > 100 ? `${r.text.slice(0, 100)}...` : r.text,
    dismissOnClick: true,
  onClick: () => {
    const path = r.guildId ? `/channels/${r.guildId}/${r.chanId}` : `/channels/@me/${r.chanId}`;
    NavigationRouter.transitionTo(path);

    setTimeout(() => {
        jumper.jumpToMessage({
            channelId: r.chanId,
            messageId: r.msgId,
            flash: true
        });
    }, 300);
}
});
    }

    reminders = reminders.filter(r => r.time > now);
    await saveReminders();
}

export default definePlugin({
    name: "MessageFollowUp",
    description: "Set reminders for Discord messages and jump back to them later.",
    authors: [{ name: "noxify", id: 1167135976209002508n }],

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
                            action={() => addReminder(message, ms)}
                        />
                    ))}
                </Menu.MenuItem>
            );
        }
    },

    async start() {
        await loadReminders();
        await checkReminders();
        checkInterval = setInterval(() => void checkReminders(), 30000);
    },

    stop() {
        clearInterval(checkInterval);
    }
});
