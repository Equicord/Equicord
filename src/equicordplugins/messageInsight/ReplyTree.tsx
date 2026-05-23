/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { classNameFactory } from "@utils/css";
import { Message, RenderModalProps } from "@vencord/discord-types";
import { findByPropsLazy } from "@webpack";
import { Modal, React } from "@webpack/common";

import { avatarUrl, formatTime, sanitizeContent } from "./utils";

const cl = classNameFactory("vc-messageinsight-");
const jumper = findByPropsLazy("jumpToMessage");

export function ReplyTreeModal({ modalProps, message, replies }: {
    modalProps: RenderModalProps;
    message: Message;
    replies: Message[];
}) {
    const preview = sanitizeContent(message.content ?? "");

    return (
        <Modal
            {...modalProps}
            size="lg"
            title="Message Replies"
        >
            <div className={cl("modal-body")}>
                <div className={cl("meta-text")}>
                    {`Message: "${preview.slice(0, 80)}${preview.length > 80 ? "…" : ""}"`}
                </div>
                {replies.length === 0 ? (
                    <p className={cl("empty-text")}>
                        No loaded replies found for this message in the current channel.
                    </p>
                ) : (
                    <>
                        <div className={cl("reply-count")}>
                            {`${replies.length} repl${replies.length === 1 ? "y" : "ies"}`}
                        </div>
                        {replies.map(reply => {
                            const sanitized = sanitizeContent(reply.content ?? "");
                            const hasAttachments = (reply.attachments?.length ?? 0) > 0;
                            const time = formatTime(reply.timestamp);

                            return (
                                <button
                                    key={reply.id}
                                    className={cl("reply-item")}
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
                                    <div className={cl("reply-header")}>
                                        {reply.author && (
                                            <img
                                                className={cl("reply-avatar")}
                                                src={avatarUrl(reply.author)}
                                                alt=""
                                            />
                                        )}
                                        <span className={cl("reply-author")}>
                                            {reply.author?.username ?? "Unknown"}
                                        </span>
                                        {time && <span className={cl("reply-time")}>{time}</span>}
                                        {hasAttachments && (
                                            <span
                                                className={cl("reply-attachment")}
                                                title="Has attachments"
                                            >
                                                📎
                                            </span>
                                        )}
                                    </div>
                                    {(sanitized || hasAttachments) && (
                                        <span className={cl("reply-content")}>
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
