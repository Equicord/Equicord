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
import type { HTMLAttributes } from "react";

const MessageClasses = findCssClassesLazy("separator", "timestamp", "timestampInline");

export function Sep(props: HTMLAttributes<HTMLElement>) {
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

function formatSmartTimestamp(date: Date): string {
    const now = new Date();

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const diffTime = today.getTime() - targetDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    const timeStr = `${hours}:${minutes}:${seconds}`;

    if (diffDays === 0) {
        return timeStr;
    } else if (diffDays === 1) {
        return `Yesterday at ${timeStr}`;
    } else {
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const year = date.getFullYear();
        return `${month}/${day}/${year} at ${timeStr}`;
    }
}

function ReplyTimestamp({
    referencedMessage,
}: {
    referencedMessage: ReferencedMessage;
    baseMessage: Message;
}) {
    if (referencedMessage.state !== ReferencedMessageState.LOADED) return null;

    const rawTimestamp = referencedMessage.message.timestamp;
    const date = rawTimestamp instanceof Date ? rawTimestamp : new Date(rawTimestamp as any);

    if (isNaN(date.getTime())) return null;

    const formatted = formatSmartTimestamp(date);

    return (
        <span className={`vc-reply-timestamp ${MessageClasses.timestamp ?? ""} ${MessageClasses.timestampInline ?? ""}`}>
            <span>
                <time dateTime={date.toISOString()}>
                    {formatted}
                </time>
            </span>
        </span>
    );
}

let observer: MutationObserver | null = null;

function updateTimestamps(): void {
    const elements = document.querySelectorAll<HTMLElement>("time[datetime]:not(.vc-reply-timestamp time)");
    elements.forEach(el => {
        const datetime = el.getAttribute("datetime");
        if (!datetime) return;

        const date = new Date(datetime);
        if (!isNaN(date.getTime())) {
            const formatted = formatSmartTimestamp(date);
            if (el.textContent !== formatted) {
                el.textContent = formatted;
            }
        }
    });
}

export default definePlugin({
    name: "RealTimestamp",
    description: "Displays smart message timestamps with seconds in 'Today / Yesterday at / M/D/YYYY at' format.",
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
            updateTimestamps();
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
        .vc-reply-timestamp {
            margin-inline-end: 0.25rem;
            vertical-align: baseline;
            cursor: default;
            user-select: none;
        }
    `
});
