/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import ErrorBoundary from "@components/ErrorBoundary";
import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import type { Message } from "@vencord/discord-types";
import { findCssClassesLazy } from "@webpack";
import { DateUtils, Timestamp } from "@webpack/common";
import type { HTMLAttributes } from "react";

const MessageClasses = findCssClassesLazy("separator", "latin24CompactTimeStamp");

function Sep(props: HTMLAttributes<HTMLElement>) {
    return <i className={MessageClasses.separator} aria-hidden={true} {...props} />;
}

const enum ReferencedMessageState {
    LOADED = 0,
    NOT_LOADED = 1,
    DELETED = 2,
}

type ReferencedMessage =
    | { state: ReferencedMessageState.LOADED; message: Message; }
    | { state: ReferencedMessageState.NOT_LOADED | ReferencedMessageState.DELETED; };

function ReplyTimestamp({
    referencedMessage,
    baseMessage,
}: {
    referencedMessage: ReferencedMessage;
    baseMessage: Message;
}) {
    if (referencedMessage.state !== ReferencedMessageState.LOADED) return null;
    const refTimestamp = referencedMessage.message.timestamp as any;
    const baseTimestamp = baseMessage.timestamp as any;
    return (
        <Timestamp
            className="eq-reply-timestamp"
            compact={DateUtils.isSameDay(refTimestamp, baseTimestamp)}
            timestamp={refTimestamp}
            isInline={false}
        >
            <Sep>[</Sep>
            {DateUtils.isSameDay(refTimestamp, baseTimestamp)
                ? DateUtils.dateFormat(refTimestamp, "LT")
                : DateUtils.calendarFormat(refTimestamp)
            }
            <Sep>]</Sep>
        </Timestamp>
    );
}

let observer: MutationObserver | null = null;
let updateScheduled = false;

function formatSmartTime(date: Date): string {
    const now = new Date();

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const diffDays = Math.round((today.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));

    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    const timeStr = `${hours}:${minutes}:${seconds}`;

    if (diffDays === 0) {
        return timeStr;
    } else if (diffDays === 1) {
        return `Yesterday at ${timeStr}`;
    } else {
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const year = date.getFullYear();
        return `${month}/${day}/${year} ${timeStr}`;
    }
}

function updateTimestamps(): void {
    const elements = document.querySelectorAll<HTMLElement>("time[datetime]");
    elements.forEach(el => {
        const datetime = el.getAttribute("datetime");
        if (!datetime) return;

        const date = new Date(datetime);
        if (!isNaN(date.getTime())) {
            const formatted = formatSmartTime(date);
            if (el.textContent !== formatted) {
                el.textContent = formatted;
            }
        }
    });
}

function scheduleUpdate(): void {
    if (!updateScheduled) {
        updateScheduled = true;
        requestAnimationFrame(() => {
            updateTimestamps();
            updateScheduled = false;
        });
    }
}

export default definePlugin({
    name: "RealTimestamp",
    description: "Displays smart message timestamps with seconds and shows timestamps on replied-message previews.",
    authors: [EquicordDevs.n6n],

    patches: [
        {
            find: "#{intl::REPLY_QUOTE_MESSAGE_NOT_LOADED}",
            replacement: {
                match: /\.onClickReply,.+?}\),(?=\i,\i,\i\])/,
                replace: "$&$self.ReplyTimestamp(arguments[0]),"
            }
        }
    ],

    ReplyTimestamp: ErrorBoundary.wrap(ReplyTimestamp, { noop: true }),

    start() {
        updateTimestamps();

        observer = new MutationObserver(() => {
            scheduleUpdate();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    },

    stop() {
        if (observer) {
            observer.disconnect();
            observer = null;
        }
    },

    css: `
        .eq-reply-timestamp {
            margin-inline-end: 0.5rem;
            width: unset !important;
        }
    `
});
