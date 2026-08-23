/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BaseText } from "@components/BaseText";
import { classNameFactory } from "@utils/css";
import { classes, getUserAvatarUrl } from "@utils/misc";
import { Message, type RenderModalProps } from "@vencord/discord-types";
import { Avatar, Checkbox, Clickable, MessageStore, Modal, moment, useLayoutEffect, useRef, useState, useStateFromStores } from "@webpack/common";

const cl = classNameFactory("vc-exportmessages-");

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

export function MultiMessageExportModal({ modalProps, initialMessage, onExport }: MultiMessageExportModalProps) {
    const messages = useStateFromStores(
        [MessageStore],
        () => {
            const cached = [...MessageStore.getMessages(initialMessage.channel_id)?._array ?? []].filter(m => !m.deleted);
            if (!cached.some(m => m.id === initialMessage.id)) cached.push(initialMessage);
            return cached.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        },
        [initialMessage]
    );

    const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set([initialMessage.id]));
    const anchorId = useRef(initialMessage.id);
    const [isExporting, setIsExporting] = useState(false);
    const initialRowRef = useRef<HTMLDivElement | null>(null);
    const selectedMessages = messages.filter(m => selectedIds.has(m.id));

    useLayoutEffect(() => {
        initialRowRef.current?.scrollIntoView({ block: "center" });
    }, []);

    function toggleMessage(message: Message, shiftKey: boolean) {
        if (shiftKey) {
            const ids = messages.map(m => m.id);
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
                {
                    text: `Export (${selectedMessages.length})`,
                    variant: "primary",
                    onClick: () => void handleExport(),
                    disabled: isExporting || selectedMessages.length === 0
                }
            ]}
        >
            <div className={cl("list")}>
                {messages.map(message => {
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
                            <div
                                ref={message.id === initialMessage.id ? initialRowRef : undefined}
                                className={cl("row-content")}
                            >
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
                })}
            </div>
        </Modal>
    );
}
