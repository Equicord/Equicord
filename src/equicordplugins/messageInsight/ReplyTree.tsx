/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findByPropsLazy } from "@webpack";
import { Modal, React } from "@webpack/common";

import { avatarUrl, formatTime, sanitizeContent } from "./utils";

const jumper = findByPropsLazy("jumpToMessage");

export function ReplyTreeModal({ modalProps, message, replies }: {
    modalProps: any;
    message: any;
    replies: any[];
}) {
    const preview = sanitizeContent(message.content ?? "");

    return (
        <Modal
            {...modalProps}
            size="lg"
            title="Message Replies"
        >
            <div className="vc-messageinsight-modal-body">
                <div className="vc-messageinsight-meta-text">
                    {`Message: "${preview.slice(0, 80)}${preview.length > 80 ? "…" : ""}"`}
                </div>
                {replies.length === 0 ? (
                    <p className="vc-messageinsight-empty-text">
                        No loaded replies found for this message in the current channel.
                    </p>
                ) : (
                    <>
                        <div className="vc-messageinsight-reply-count">
                            {`${replies.length} repl${replies.length === 1 ? "y" : "ies"}`}
                        </div>
                        {replies.map((reply: any) => {
                            const sanitized = sanitizeContent(reply.content ?? "");
                            const hasAttachments = (reply.attachments?.length ?? 0) > 0;
                            const time = formatTime(reply.timestamp);

                            return (
                                <button
                                    key={reply.id}
                                    className="vc-messageinsight-reply-item"
                                    onClick={() => {
                                        modalProps.onClose();
                                        jumper.jumpToMessage({
                                            channelId: reply.channel_id,
                                            messageId: reply.id,
                                            flash: true,
                                            jumpType: "INSTANT",
                                        });
                                    }}
                                >
                                    <div className="vc-messageinsight-reply-header">
                                        {reply.author && (
                                            <img
                                                className="vc-messageinsight-reply-avatar"
                                                src={avatarUrl(reply.author)}
                                                alt=""
                                            />
                                        )}
                                        <span className="vc-messageinsight-reply-author">
                                            {reply.author?.username ?? "Unknown"}
                                        </span>
                                        {time && <span className="vc-messageinsight-reply-time">{time}</span>}
                                        {hasAttachments && (
                                            <span
                                                className="vc-messageinsight-reply-attachment"
                                                title="Has attachments"
                                            >
                                                📎
                                            </span>
                                        )}
                                    </div>
                                    {(sanitized || hasAttachments) && (
                                        <span className="vc-messageinsight-reply-content">
                                            {sanitized
                                                ? sanitized.slice(0, 140) + (sanitized.length > 140 ? "…" : "")
                                                : "Attachment"}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </>
                )}
            </div>
        </Modal>
    );
}
