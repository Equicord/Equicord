/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { React, ScrollerThin } from "@webpack/common";

import { getLogs, logSubscribe } from "../logs";
import { cl } from "../store";
import { LogEntry } from "../types";
import { LogEntryComponent } from "./LogEntry";

export function LogsTab() {
    const logs: LogEntry[] = React.useSyncExternalStore(logSubscribe, getLogs);

    if (logs.length === 0) return <div className={cl("empty")}>No voice events logged yet.</div>;

    return (
        <ScrollerThin fade className={cl("scroller")}>
            {logs.map((entry, i) => {
                const elements: React.ReactNode[] = [];

                if (i === 0 || entry.timestamp.toDateString() !== logs[i - 1].timestamp.toDateString()) {
                    elements.push(
                        <div key={`sep-${i}`} className={cl("date-separator")} role="separator" aria-label={entry.timestamp.toDateString()}>
                            <span>{entry.timestamp.toDateString()}</span>
                        </div>
                    );
                }

                elements.push(<LogEntryComponent key={`entry-${i}`} entry={entry} />);
                return elements;
            })}
        </ScrollerThin>
    );
}
