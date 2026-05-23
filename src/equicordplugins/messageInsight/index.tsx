/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { addMessagePopoverButton, removeMessagePopoverButton } from "@api/MessagePopover";
import ErrorBoundary from "@components/ErrorBoundary";
import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { ChannelStore, FluxDispatcher, MessageStore, openModal, React } from "@webpack/common";

import { ChannelBriefModal } from "./ChannelBrief";
import { EditDiffModal } from "./EditDiff";
import { ReplyTreeModal } from "./ReplyTree";
import { settings } from "./settings";

const MAX_CACHE_SIZE = 1000;

// messageId -> [original, ...edits]
const editHistory = new Map<string, string[]>();
// messageId -> latest cached content (for capturing pre-edit state)
const messageCache = new Map<string, string>();
// channelId -> { lastVisitTime, messageCount }
const channelVisitData = new Map<string, { time: number; count: number; }>();

function onMessageCreate({ message }: any) {
    if (message?.id && message.content !== undefined) {
        if (messageCache.size >= MAX_CACHE_SIZE) {
            messageCache.delete(messageCache.keys().next().value!);
        }
        messageCache.set(message.id, message.content);
    }
}

function onMessageUpdate({ message }: any) {
    if (!settings.store.editDiff) return;
    if (!message?.id || message.content === undefined) return;

    const oldContent = messageCache.get(message.id);
    if (oldContent !== undefined && oldContent !== message.content) {
        const history = editHistory.get(message.id);
        if (!history) {
            if (editHistory.size >= MAX_CACHE_SIZE) {
                editHistory.delete(editHistory.keys().next().value!);
            }
            editHistory.set(message.id, [oldContent, message.content]);
        } else {
            history.push(message.content);
        }
    }
    messageCache.set(message.id, message.content);
}

function onChannelSelect({ channelId }: any) {
    if (!channelId || !settings.store.channelBrief) return;

    const prev = channelVisitData.get(channelId);
    const msgsArray = MessageStore.getMessages(channelId)?._array ?? [];

    if (prev) {
        const newMsgs = msgsArray.filter(m => {
            const ts = Number(new Date(m.timestamp.toString()));
            return !isNaN(ts) && ts > prev.time;
        });
        const newCount = newMsgs.length;
        const elapsed = Math.floor((Date.now() - prev.time) / 60000);

        if (newCount > 0 && elapsed >= settings.store.briefThresholdMinutes) {
            const previewCount = Math.max(1, settings.store.briefPreviewCount ?? 5);
            const preview = newMsgs.slice(-previewCount);
            openModal(props => (
                <ErrorBoundary>
                    <ChannelBriefModal
                        modalProps={props}
                        newMessages={preview}
                        totalCount={newCount}
                        elapsed={elapsed}
                    />
                </ErrorBoundary>
            ));
        }
    }

    channelVisitData.set(channelId, { time: Date.now(), count: msgsArray.length });
}

function EditDiffIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
        </svg>
    );
}

function ReplyTreeIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
        </svg>
    );
}

function renderEditDiffButton(message: any) {
    if (!settings.store.editDiff) return null;
    const history = editHistory.get(message.id);
    if (!history || history.length < 2) return null;

    const editCount = history.length - 1;
    return {
        key: "mi-edit-diff",
        label: `Show Edit History (${editCount}×)`,
        icon: EditDiffIcon,
        message,
        channel: ChannelStore.getChannel(message.channel_id),
        onClick: () => openModal(props => (
            <ErrorBoundary>
                <EditDiffModal modalProps={props} history={history} />
            </ErrorBoundary>
        )),
    };
}

function renderReplyTreeButton(message: any) {
    if (!settings.store.replyTree) return null;

    return {
        key: "mi-reply-tree",
        label: "Show Reply Tree",
        icon: ReplyTreeIcon,
        message,
        channel: ChannelStore.getChannel(message.channel_id),
        onClick: () => {
            const replies = (MessageStore.getMessages(message.channel_id)?._array ?? []).filter(
                (m: any) => m.messageReference?.message_id === message.id
            );
            openModal(props => (
                <ErrorBoundary>
                    <ReplyTreeModal modalProps={props} message={message} replies={replies} />
                </ErrorBoundary>
            ));
        },
    };
}

export default definePlugin({
    name: "MessageInsight",
    description: "Advanced message tools: edit diff, reply tree, and channel brief",
    authors: [EquicordDevs.LOSTSTR],
    tags: ["Chat", "Utility"],
    settings,
    dependencies: ["MessagePopoverAPI"],

    start() {
        addMessagePopoverButton("MessageInsight-editDiff", renderEditDiffButton, EditDiffIcon);
        addMessagePopoverButton("MessageInsight-replyTree", renderReplyTreeButton, ReplyTreeIcon);
        FluxDispatcher.subscribe("MESSAGE_CREATE", onMessageCreate);
        FluxDispatcher.subscribe("MESSAGE_UPDATE", onMessageUpdate);
        FluxDispatcher.subscribe("CHANNEL_SELECT", onChannelSelect);
    },

    stop() {
        removeMessagePopoverButton("MessageInsight-editDiff");
        removeMessagePopoverButton("MessageInsight-replyTree");
        FluxDispatcher.unsubscribe("MESSAGE_CREATE", onMessageCreate);
        FluxDispatcher.unsubscribe("MESSAGE_UPDATE", onMessageUpdate);
        FluxDispatcher.unsubscribe("CHANNEL_SELECT", onChannelSelect);
        editHistory.clear();
        messageCache.clear();
        channelVisitData.clear();
    },
});
