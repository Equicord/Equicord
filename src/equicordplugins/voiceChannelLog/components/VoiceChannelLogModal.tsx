/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { classes } from "@utils/misc";
import { Channel, RenderModalProps } from "@vencord/discord-types";
import { AccessibilityStore, Alerts, Modal, openModal, React, ScrollerThin } from "@webpack/common";

import { clearLogs, getVcLogs, vcLogSubscribe } from "../logs";
import { VoiceChannelLogEntry } from "../types";
import { cl } from "../utils";
import { VoiceChannelLogEntryComponent } from "./VoiceChannelLogEntryComponent";

export function openVoiceChannelLog(channel: Channel) {
    return openModal(props => (
        <VoiceChannelLogModal props={props} channel={channel} />
    ));
}

interface DayGroup {
    key: string;
    date: Date;
    entries: VoiceChannelLogEntry[];
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const formatTime = (d: Date) => d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

function formatDay(date: Date) {
    return date.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function relativeDay(date: Date): string | null {
    const now = new Date();
    if (date.toDateString() === now.toDateString()) return "Today";

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

    return null;
}

/** Entries are kept in the order given; consecutive entries on the same day share a group. */
function groupByDay(entries: VoiceChannelLogEntry[]): DayGroup[] {
    const groups: DayGroup[] = [];

    for (const entry of entries) {
        const key = entry.timestamp.toDateString();
        const last = groups[groups.length - 1];

        if (last && last.key === key) last.entries.push(entry);
        else groups.push({ key, date: entry.timestamp, entries: [entry] });
    }

    return groups;
}

export function VoiceChannelLogModal({ channel, props }: { channel: Channel; props: RenderModalProps; }) {
    const logs = React.useSyncExternalStore(vcLogSubscribe, () => getVcLogs(channel.id));
    const [newestFirst, setNewestFirst] = React.useState(true);
    const [collapsed, setCollapsed] = React.useState<Set<string>>(() => new Set());

    const groups = React.useMemo(
        () => groupByDay(newestFirst ? [...logs].reverse() : logs),
        [logs, newestFirst]
    );

    const userCount = React.useMemo(() => new Set(logs.map(e => e.userId)).size, [logs]);

    const toggle = (key: string) => setCollapsed(prev => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
    });

    return (
        <Modal
            {...props}
            size="lg"
            title={`${channel.name} logs`}
            actions={[
                {
                    text: newestFirst ? "Show oldest first" : "Show newest first",
                    variant: "secondary",
                    disabled: logs.length === 0,
                    onClick: () => setNewestFirst(v => !v)
                },
                {
                    text: "Clear logs",
                    variant: "dangerPrimary",
                    disabled: logs.length === 0,
                    onClick: () => Alerts.show({
                        title: "Clear logs",
                        body: `Delete all ${plural(logs.length, "event")} logged in ${channel.name}? This can't be undone.`,
                        confirmText: "Clear",
                        cancelText: "Cancel",
                        onConfirm: () => clearLogs(channel.id)
                    })
                }
            ]}
        >
            <ScrollerThin fade className={classes(cl("scroller"), `group-spacing-${AccessibilityStore.messageGroupSpacing}`)}>
                <div className={cl("body")}>
                    {logs.length === 0 ? (
                        <div className={cl("empty")}>
                            <span className={cl("empty-title")}>No events yet</span>
                            <span>Voice events in this channel will show up here as they happen.</span>
                        </div>
                    ) : (
                        <>
                            <div className={cl("summary")} aria-live="polite">
                                <span>{plural(logs.length, "event")}</span>
                                <span>{plural(userCount, "user")}</span>
                                <span>{newestFirst ? "Newest first" : "Oldest first"}</span>
                            </div>

                            {groups.map(group => {
                                const open = !collapsed.has(group.key);
                                const relative = relativeDay(group.date);
                                const times = group.entries.map(e => e.timestamp.getTime());
                                const first = formatTime(new Date(Math.min(...times)));
                                const last = formatTime(new Date(Math.max(...times)));
                                const users = new Set(group.entries.map(e => e.userId)).size;

                                return (
                                    <section key={group.key} className={cl("day")}>
                                        <button
                                            type="button"
                                            className={cl("day-header")}
                                            aria-expanded={open}
                                            onClick={() => toggle(group.key)}
                                        >
                                            <span className={cl("day-chevron")} aria-hidden>{open ? "▾" : "▸"}</span>
                                            <span className={cl("day-label")}>{formatDay(group.date)}</span>
                                            <span className={cl("day-meta")}>
                                                {relative && <span>{relative}</span>}
                                                <span>{plural(group.entries.length, "event")}</span>
                                                <span>{plural(users, "user")}</span>
                                                <span>{first === last ? first : `${first} – ${last}`}</span>
                                            </span>
                                        </button>

                                        {open && (
                                            <ul className={cl("day-entries")}>
                                                {group.entries.map((entry, i) => (
                                                    <VoiceChannelLogEntryComponent
                                                        key={`${entry.timestamp.getTime()}-${entry.userId}-${entry.type}-${i}`}
                                                        logEntry={entry}
                                                        channel={channel}
                                                    />
                                                ))}
                                            </ul>
                                        )}
                                    </section>
                                );
                            })}
                        </>
                    )}
                </div>
            </ScrollerThin>
        </Modal>
    );
}