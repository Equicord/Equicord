/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BaseText } from "@components/BaseText";
import { classNameFactory } from "@utils/css";
import { classes, getUserAvatarUrl } from "@utils/misc";
import { Message, type RenderModalProps, type ScrollerBaseRef } from "@vencord/discord-types";
import { findByCodeLazy } from "@webpack";
import { Avatar, Checkbox, Clickable, Constants, ListScrollerThin, MessageStore, Modal, moment, RestAPI, showToast, SnowflakeUtils, Toasts, useEffect, useLayoutEffect, useRef, useState } from "@webpack/common";

const cl = classNameFactory("vc-exportmessages-");
const PAGE_SIZE = 50;
const AROUND_LIMIT = PAGE_SIZE * 2;
const ROW_HEIGHT = 50;

const createMessageRecord = findByCodeLazy(".createFromServer(", ".isBlockedForMessage", "messageReference:");

type PageDirection = "before" | "after";

interface MessageHistory {
    messages: Message[];
    hasMoreBefore: boolean;
    hasMoreAfter: boolean;
    needsAround: boolean;
}

interface MultiMessageExportModalProps {
    modalProps: RenderModalProps;
    initialMessage: Message;
    onExport(messages: Message[]): Promise<boolean>;
}

function getMessagePreview(message: Message) {
    if (message.content) return message.content;
    if (message.attachments?.length > 0) return message.attachments.map(a => a.filename).join(", ");
    if (message.embeds?.length > 0) return message.embeds.map(e => e.rawTitle ?? "Embed").join(", ");
    return "";
}

function mergeMessages(messages: Message[], initialMessage: Message) {
    const messagesById = new Map<string, Message>();
    for (const message of messages) {
        if (!message.deleted) messagesById.set(message.id, message);
    }
    messagesById.set(initialMessage.id, messagesById.get(initialMessage.id) ?? initialMessage);

    return [...messagesById.values()].sort((a, b) => SnowflakeUtils.compare(a.id, b.id));
}

function getInitialHistory(initialMessage: Message): MessageHistory {
    const cache = MessageStore.getMessages(initialMessage.channel_id);
    const cached = [
        ...(cache?._before?._messages ?? []),
        ...(cache?._array ?? []),
        ...(cache?._after?._messages ?? [])
    ];
    const initialIsCached = cached.some(message => message.id === initialMessage.id);
    const messages = mergeMessages(initialIsCached ? cached : [], initialMessage);
    const initialIndex = messages.findIndex(message => message.id === initialMessage.id);
    const hasMoreBefore = !initialIsCached || Boolean(cache?.hasMoreBefore);
    const hasMoreAfter = !initialIsCached || Boolean(cache?.hasMoreAfter);

    return {
        messages,
        hasMoreBefore,
        hasMoreAfter,
        needsAround: !initialIsCached
            || hasMoreBefore && initialIndex < PAGE_SIZE / 2
            || hasMoreAfter && messages.length - initialIndex - 1 < PAGE_SIZE / 2
    };
}

async function fetchMessagePage(channelId: string, query: Record<string, string | number>) {
    const response = await RestAPI.get({
        url: Constants.Endpoints.MESSAGES(channelId),
        query
    });

    if (!Array.isArray(response?.body)) throw new Error("Invalid message response");
    return response.body.map(message => createMessageRecord(message) as Message);
}

export function MultiMessageExportModal({ modalProps, initialMessage, onExport }: MultiMessageExportModalProps) {
    const [history, setHistory] = useState(() => getInitialHistory(initialMessage));
    const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set([initialMessage.id]));
    const anchorId = useRef(initialMessage.id);
    const [isExporting, setIsExporting] = useState(false);
    const [initialLoadFailed, setInitialLoadFailed] = useState(false);
    const [aroundAttempt, setAroundAttempt] = useState(0);
    const historyRef = useRef(history);
    const isLoadingRef = useRef(history.needsAround);
    const requestGeneration = useRef(0);
    const listRef = useRef<ScrollerBaseRef>(null);
    const listContainerRef = useRef<HTMLDivElement>(null);
    const pendingScroll = useRef<"center" | { distanceFromTop: number; added: number; } | null>("center");
    const selectedMessages = history.messages.filter(message => selectedIds.has(message.id));

    historyRef.current = history;

    useLayoutEffect(() => {
        const scroller = listRef.current;
        const pending = pendingScroll.current;
        if (!scroller || !pending) return;

        if (pending === "center") {
            const initialIndex = history.messages.findIndex(message => message.id === initialMessage.id);
            const viewportHeight = listContainerRef.current?.clientHeight ?? ROW_HEIGHT;
            scroller.scrollTo({
                to: Math.max(0, initialIndex * ROW_HEIGHT - (viewportHeight - ROW_HEIGHT) / 2)
            });
        } else {
            scroller.scrollTo({ to: pending.distanceFromTop + pending.added * ROW_HEIGHT });
        }
        pendingScroll.current = null;
    }, [history.messages]);

    useEffect(() => {
        if (!history.needsAround) return () => void requestGeneration.current++;

        const generation = ++requestGeneration.current;
        isLoadingRef.current = true;
        setInitialLoadFailed(false);
        void fetchMessagePage(initialMessage.channel_id, {
            around: initialMessage.id,
            limit: AROUND_LIMIT
        }).then(fetched => {
            if (requestGeneration.current !== generation) return;
            const { current } = historyRef;
            const olderCount = fetched.filter(message => SnowflakeUtils.compare(message.id, initialMessage.id) < 0).length;
            const laterCount = fetched.filter(message => SnowflakeUtils.compare(message.id, initialMessage.id) > 0).length;

            pendingScroll.current = "center";
            setHistory({
                messages: mergeMessages([...current.messages, ...fetched], initialMessage),
                hasMoreBefore: current.hasMoreBefore && olderCount >= PAGE_SIZE - 1,
                hasMoreAfter: current.hasMoreAfter && laterCount >= PAGE_SIZE - 1,
                needsAround: false
            });
        }).catch(() => {
            if (requestGeneration.current === generation) {
                setInitialLoadFailed(true);
                showToast("Failed to load more messages.", Toasts.Type.FAILURE);
            }
        }).finally(() => {
            if (requestGeneration.current !== generation) return;
            isLoadingRef.current = false;
        });

        return () => {
            requestGeneration.current++;
        };
    }, [initialMessage.channel_id, initialMessage.id, aroundAttempt]);

    async function loadMore(direction: PageDirection) {
        const { current } = historyRef;
        const hasMore = direction === "before" ? current.hasMoreBefore : current.hasMoreAfter;
        if (isLoadingRef.current || !hasMore) return;

        const cursor = direction === "before" ? current.messages[0] : current.messages.at(-1);
        if (!cursor) return;

        const generation = ++requestGeneration.current;
        isLoadingRef.current = true;

        try {
            const fetched = await fetchMessagePage(initialMessage.channel_id, {
                [direction]: cursor.id,
                limit: PAGE_SIZE
            });
            if (requestGeneration.current !== generation) return;

            const messages = mergeMessages([...current.messages, ...fetched], initialMessage);
            const added = messages.length - current.messages.length;
            if (direction === "before" && added > 0)
                pendingScroll.current = {
                    distanceFromTop: listRef.current?.getDistanceFromTop() ?? 0,
                    added
                };

            setHistory({
                messages,
                hasMoreBefore: direction === "before" ? fetched.length === PAGE_SIZE && added > 0 : current.hasMoreBefore,
                hasMoreAfter: direction === "after" ? fetched.length === PAGE_SIZE && added > 0 : current.hasMoreAfter,
                needsAround: false
            });
        } catch {
            if (requestGeneration.current === generation)
                showToast(`Failed to load ${direction === "before" ? "earlier" : "later"} messages.`, Toasts.Type.FAILURE);
        } finally {
            if (requestGeneration.current !== generation) return;
            isLoadingRef.current = false;
        }
    }

    function handleScroll() {
        const scroller = listRef.current;
        if (!scroller || isLoadingRef.current) return;

        const { current } = historyRef;
        if (current.hasMoreBefore && scroller.getDistanceFromTop() < ROW_HEIGHT * 2)
            void loadMore("before");
        else if (current.hasMoreAfter && scroller.getDistanceFromBottom() < ROW_HEIGHT * 2)
            void loadMore("after");
    }

    function retryInitialLoad() {
        if (!isLoadingRef.current) setAroundAttempt(attempt => attempt + 1);
    }

    function toggleMessage(message: Message, shiftKey: boolean) {
        if (shiftKey) {
            const ids = history.messages.map(m => m.id);
            const start = ids.indexOf(anchorId.current);
            const end = ids.indexOf(message.id);
            if (start !== -1 && end !== -1) {
                const [from, to] = start <= end ? [start, end] : [end, start];
                setSelectedIds(prev => {
                    const next = new Set(prev);
                    const shouldSelect = !next.has(message.id);
                    for (const id of ids.slice(from, to + 1)) {
                        if (shouldSelect) next.add(id);
                        else next.delete(id);
                    }
                    return next;
                });
                anchorId.current = message.id;
                return;
            }
        }

        anchorId.current = message.id;
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(message.id)) next.delete(message.id);
            else next.add(message.id);
            return next;
        });
    }

    async function handleExport() {
        if (isExporting || selectedMessages.length === 0) return;

        setIsExporting(true);
        if (await onExport(selectedMessages)) {
            modalProps.onClose();
            return;
        }
        setIsExporting(false);
    }

    return (
        <Modal
            {...modalProps}
            size="lg"
            title="Export Messages"
            subtitle="Shift-click to select multiple messages."
            actions={[
                {
                    text: "Cancel",
                    variant: "secondary",
                    onClick: modalProps.onClose,
                    disabled: isExporting
                },
                ...(initialLoadFailed ? [{
                    text: "Retry",
                    variant: "secondary" as const,
                    onClick: retryInitialLoad,
                    disabled: isExporting
                }] : []),
                {
                    text: `Export (${selectedMessages.length})`,
                    variant: "primary",
                    onClick: () => void handleExport(),
                    disabled: isExporting || selectedMessages.length === 0
                }
            ]}
        >
            <div ref={listContainerRef} className={cl("list")}>
                <ListScrollerThin
                    ref={listRef}
                    className={cl("list-scroller")}
                    sections={[history.messages.length]}
                    sectionHeight={0}
                    rowHeight={ROW_HEIGHT}
                    renderSection={() => null}
                    onScroll={handleScroll}
                    innerRole="group"
                    innerAriaLabel="Messages available to export"
                    renderRow={({ row }) => {
                        const message = history.messages[row];
                        const isSelected = selectedIds.has(message.id);
                        const { author } = message;
                        const name = author.globalName ?? author.username;

                        return (
                            <Clickable
                                key={message.id}
                                className={classes(cl("row"), isSelected && cl("row-selected"))}
                                role="checkbox"
                                aria-checked={isSelected}
                                onClick={e => toggleMessage(message, e.shiftKey)}
                            >
                                <div className={cl("checkbox")}>
                                    <Checkbox
                                        value={isSelected}
                                        onChange={() => { }}
                                        displayOnly
                                        size={20}
                                    />
                                </div>
                                <div className={cl("row-content")}>
                                    <Avatar src={getUserAvatarUrl(author)} size="SIZE_32" aria-label={name} />
                                    <div className={cl("details")}>
                                        <div className={cl("meta")}>
                                            <BaseText size="sm" weight="medium">{name}</BaseText>
                                            <BaseText size="xs" color="text-subtle">
                                                {moment(message.timestamp).format("L LT")}
                                            </BaseText>
                                        </div>
                                        <BaseText size="sm" color="text-muted" className={cl("preview")}>
                                            {getMessagePreview(message)}
                                        </BaseText>
                                    </div>
                                </div>
                            </Clickable>
                        );
                    }}
                />
            </div>
        </Modal>
    );
}
