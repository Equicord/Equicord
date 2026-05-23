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

export function ChannelBriefModal({ modalProps, newMessages, totalCount, elapsed }: {
    modalProps: RenderModalProps;
    newMessages: Message[];
    totalCount: number;
    elapsed: number;
}) {
    const showing = newMessages.length;
    const hasMore = totalCount > showing;

    return (
        <Modal
            {...modalProps}
            size="sm"
            title="Channel Brief"
        >
            <div className={cl("brief-body")}>
                <div className={cl("brief-header")}>
                    {hasMore
                        ? `${totalCount} new messages in the last ${elapsed} min — showing last ${showing}`
                        : `${totalCount} new message${totalCount !== 1 ? "s" : ""} in the last ${elapsed} min`}
                </div>
                {newMessages.map(msg => {
                    const sanitized = sanitizeContent(msg.content ?? "");
                    const hasAttachments = (msg.attachments?.length ?? 0) > 0;
                    const time = formatTime(msg.timestamp);

                    return (
                        <div key={msg.id} className={cl("brief-item")}>
                            <div className={cl("reply-header")}>
                                {msg.author && (
                                    <img
                                        className={cl("reply-avatar")}
                                        src={avatarUrl(msg.author)}
                                        alt=""
                                    />
                                )}
                                <span className={cl("reply-author")}>
                                    {msg.author?.username ?? "Unknown"}
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
                            <div className={cl("brief-content-row")}>
                                <span className={cl("reply-content")}>
                                    {sanitized
                                        ? sanitized.slice(0, 120) + (sanitized.length > 120 ? "…" : "")
                                        : "Attachment"}
                                </span>
                                <button
                                    className={cl("brief-jump")}
                                    title="Jump to message"
                                    onClick={() => {
                                        modalProps.onClose();
                                        jumper.jumpToMessage({
                                            channelId: msg.channel_id,
                                            messageId: msg.id,
                                            flash: true,
                                            jumpType: "INSTANT",
                                        });
                                    }}
                                >
                                    ↗
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </Modal>
    );
}
