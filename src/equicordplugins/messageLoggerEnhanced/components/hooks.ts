/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useEffect, useState } from "@webpack/common";

import {
    countMessagesByStatusIDB,
    countMessagesIDB,
    DBMessageRecord,
    DBMessageStatus,
    getDateStortedMessagesByStatusIDB,
    getRawMessagesByStatusIDB,
    hydrateRecordsForDisplay,
} from "../db";
import { doesMatch, tokenizeQuery } from "../utils/parseQuery";
import { LogTabs } from "./LogsModal";

const SEARCH_YIELD_INTERVAL = 500;

function useDebouncedValue<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

function matchesQuery(record: DBMessageRecord, queries: ReturnType<typeof tokenizeQuery>["queries"], rest: string[]) {
    for (const query of queries) {
        const matching = doesMatch(query.key, query.value, record.message);
        if (query.negate ? matching : !matching) {
            return false;
        }
    }

    if (rest.length === 0) return true;

    const content = record.message.content?.toLowerCase() ?? "";
    if (rest.every(r => content.includes(r))) return true;

    const searchableText = getSearchableMessageText(record);
    return rest.every(r => searchableText.includes(r));
}

function getSearchableMessageText(record: DBMessageRecord) {
    const parts: string[] = [];
    const msg = record.message;

    if (msg.content) parts.push(msg.content);
    if (msg.author?.username) parts.push(msg.author.username);
    if (msg.author?.globalName) parts.push(msg.author.globalName);
    if (msg.nick) parts.push(msg.nick);

    if (Array.isArray(msg.attachments)) {
        for (const att of msg.attachments) {
            if (att.filename) parts.push(att.filename);
            if (att.url) parts.push(att.url);
        }
    }

    if (Array.isArray(msg.embeds)) {
        for (const emb of msg.embeds) {
            if (emb.title) parts.push(emb.title);
            if (emb.description) parts.push(emb.description);
            if (emb.author?.name) parts.push(emb.author.name);
            if (emb.footer?.text) parts.push(emb.footer.text);
            if (Array.isArray(emb.fields)) {
                for (const f of emb.fields) {
                    if (f.name) parts.push(f.name);
                    if (f.value) parts.push(f.value);
                }
            }
        }
    }

    if (Array.isArray(msg.editHistory)) {
        for (const edit of msg.editHistory) {
            if (typeof edit === "string") {
                parts.push(edit);
            } else if (edit && typeof edit === "object" && "content" in edit && typeof edit.content === "string") {
                parts.push(edit.content);
            }
        }
    }

    return parts.join("\n").toLowerCase();
}

export function useMessages(query: string, currentTab: LogTabs, sortNewest: boolean, page: number, pageSize: number) {
    const [pending, setPending] = useState(true);
    const [messages, setMessages] = useState<DBMessageRecord[]>([]);
    const [statusTotal, setStatusTotal] = useState<number>(0);
    const [total, setTotal] = useState<number>(0);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    const debouncedQuery = useDebouncedValue(query, 300);

    useEffect(() => {
        countMessagesIDB().then(x => setTotal(x));
    }, [reloadKey]);

    useEffect(() => {
        let isMounted = true;

        const loadMessages = async () => {
            setPending(true);
            const status = getStatus(currentTab);
            const trimmedQuery = debouncedQuery.trim();
            const offset = page * pageSize;
            const fetchLimit = pageSize + 1;

            try {
                if (trimmedQuery === "") {
                    const [rawMessages, statusTotal] = await Promise.all([
                        getDateStortedMessagesByStatusIDB(sortNewest, fetchLimit, status, offset),
                        countMessagesByStatusIDB(status),
                    ]);
                    const visibleMessages = rawMessages.slice(0, pageSize);

                    if (isMounted) {
                        setMessages(visibleMessages);
                        setStatusTotal(statusTotal);
                        setHasNextPage(rawMessages.length > pageSize);
                    }

                    return;
                }

                const { queries, rest } = tokenizeQuery(trimmedQuery);
                const normalizedRest = rest.map(r => r.toLowerCase());
                const rawMessages = await getRawMessagesByStatusIDB(status);
                const sortedMessages = sortNewest ? rawMessages.slice().reverse() : rawMessages;
                const filteredMessages: DBMessageRecord[] = [];
                let skippedMatches = 0;
                let hasMore = false;

                for (let i = 0; i < sortedMessages.length; i++) {
                    const record = sortedMessages[i];

                    if (matchesQuery(record, queries, normalizedRest)) {
                        if (skippedMatches < offset) {
                            skippedMatches++;
                        } else if (filteredMessages.length >= pageSize) {
                            hasMore = true;
                            break;
                        } else {
                            filteredMessages.push(record);
                        }
                    }

                    if (i > 0 && i % SEARCH_YIELD_INTERVAL === 0) {
                        await new Promise(resolve => setTimeout(resolve, 0));
                    }
                }

                const hydratedMessages = await hydrateRecordsForDisplay(filteredMessages);

                if (isMounted) {
                    setMessages(hydratedMessages);
                    setStatusTotal(hasMore ? Number.MAX_SAFE_INTEGER : offset + hydratedMessages.length);
                    setHasNextPage(hasMore);
                }
            } finally {
                if (isMounted) setPending(false);
            }
        };

        loadMessages().catch(() => {
            if (!isMounted) return;
            setMessages([]);
            setStatusTotal(0);
            setHasNextPage(false);
            setPending(false);
        });

        return () => {
            isMounted = false;
        };

    }, [debouncedQuery, sortNewest, page, pageSize, currentTab, reloadKey]);

    return { messages, statusTotal, total, pending, hasNextPage, reset: () => setReloadKey(key => key + 1) };
}

function getStatus(currentTab: LogTabs) {
    switch (currentTab) {
        case LogTabs.DELETED:
            return DBMessageStatus.DELETED;
        case LogTabs.EDITED:
            return DBMessageStatus.EDITED;
        default:
            return DBMessageStatus.GHOST_PINGED;
    }
}
