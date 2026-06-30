/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { generateId } from "@api/Commands";
import ErrorBoundary from "@components/ErrorBoundary";
import { classNameFactory } from "@utils/css";
import { LazyComponent } from "@utils/react";
import type { Message, MessageAttachment } from "@vencord/discord-types";
import { find, findByCodeLazy } from "@webpack";
import { moment, SelectedChannelStore, useEffect, useMemo, useRef, UserStore, useState } from "@webpack/common";

const cl = classNameFactory("vc-cmdpal-");

const createBotMessage = findByCodeLazy('username:"Clyde"');
const populateMessagePrototype = findByCodeLazy("isProbablyAValidSnowflake", "messageReference:");

const MessagePreview = LazyComponent<{
    className: string;
    author: { nick?: string; username: string; id: string; };
    message: Message;
    compact: boolean;
    isGroupStart: boolean;
    hideSimpleEmbedContent: boolean;
}>(() => find(m => m?.type?.toString().includes("previewLinkTarget:") && !m?.type?.toString().includes("HAS_THREAD")));

function getImageBox(url: string): Promise<{ width: number; height: number; } | null> {
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve({ width: img.width, height: img.height });
        img.onerror = () => resolve(null);
        img.src = url;
    });
}

async function buildAttachments(files: File[]): Promise<MessageAttachment[]> {
    return Promise.all(files.map(async file => {
        const url = URL.createObjectURL(file);
        const attachment: MessageAttachment = {
            id: generateId(),
            filename: file.name,
            content_type: undefined,
            size: file.size,
            spoiler: false,
            url: url + "#",
            proxy_url: url + "#",
        };

        if (file.type.startsWith("image/")) {
            const box = await getImageBox(url);
            if (box) {
                attachment.width = box.width;
                attachment.height = box.height;
            }
        } else if (file.type) {
            attachment.content_type = file.type;
        }

        return attachment;
    }));
}

export function MessageMarkdownPreview({ content, channelId, files }: {
    content: string;
    channelId?: string | null;
    files?: File[];
}) {
    const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
    const attachmentsRef = useRef(attachments);
    attachmentsRef.current = attachments;

    useEffect(() => {
        if (!files?.length) {
            setAttachments(prev => {
                for (const attachment of prev) {
                    URL.revokeObjectURL(attachment.url.replace(/#$/, ""));
                }
                return [];
            });
            return;
        }

        let cancelled = false;
        void buildAttachments(files).then(next => {
            if (cancelled) {
                for (const attachment of next) {
                    URL.revokeObjectURL(attachment.url.replace(/#$/, ""));
                }
                return;
            }
            setAttachments(prev => {
                for (const attachment of prev) {
                    URL.revokeObjectURL(attachment.url.replace(/#$/, ""));
                }
                return next;
            });
        });

        return () => {
            cancelled = true;
            for (const attachment of attachmentsRef.current) {
                URL.revokeObjectURL(attachment.url.replace(/#$/, ""));
            }
        };
    }, [files]);

    const message = useMemo((): Message | null => {
        if (!content.trim() && attachments.length === 0) return null;

        const resolvedChannelId = channelId ?? SelectedChannelStore.getChannelId() ?? "1337";
        const draft = createBotMessage({ content, channelId: resolvedChannelId, embeds: [] });
        if (!draft) return null;

        draft.id = generateId();
        draft.author = UserStore.getCurrentUser();
        draft.timestamp = moment();

        return populateMessagePrototype(draft) ?? draft;
    }, [attachments, channelId, content]);

    if (!message && attachments.length === 0) return null;

    const user = UserStore.getCurrentUser();
    const author = { ...user, nick: user.globalName || user.username };

    return (
        <div className={cl("markdown-preview")}>
            <div className={cl("markdown-preview-label")}>Preview</div>
            <div className={cl("markdown-preview-body")}>
                {content.trim() && message && (
                    <ErrorBoundary noop>
                        <MessagePreview
                            className={cl("message-preview")}
                            author={author}
                            message={message}
                            compact={false}
                            isGroupStart
                            hideSimpleEmbedContent={false}
                        />
                    </ErrorBoundary>
                )}
                {attachments.length > 0 && (
                    <div className={cl("preview-attachments")}>
                        {attachments.map(attachment => {
                            const src = attachment.url.replace(/#$/, "");
                            if (attachment.width && attachment.height) {
                                return (
                                    <img
                                        key={attachment.id}
                                        className={cl("preview-image")}
                                        src={src}
                                        alt={attachment.filename}
                                    />
                                );
                            }
                            if (attachment.content_type?.startsWith("video/")) {
                                return (
                                    <video
                                        key={attachment.id}
                                        className={cl("preview-video")}
                                        src={src}
                                        controls
                                        preload="metadata"
                                    />
                                );
                            }
                            return (
                                <div key={attachment.id} className={cl("preview-file")}>
                                    {attachment.filename}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
