/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addChatBarButton, ChatBarButton, removeChatBarButton } from "@api/ChatButtons";
import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { Button } from "@components/Button";
import { EquicordDevs } from "@utils/index";
import { sleep } from "@utils/misc";
import definePlugin from "@utils/types";
import { Message, RenderModalProps } from "@vencord/discord-types";
import { ChannelStore, ConfirmModal, Menu, Modal, NavigationRouter, openMediaModal, openModal, RestAPI, SelectedChannelStore, showToast, Toasts, useEffect, UserStore, useState } from "@webpack/common";

// --- Selection store ---

const selectedMessages = new Map<string, Message>();
const selectionListeners = new Set<() => void>();

let styleEl: HTMLStyleElement | null = null;

function notifyListeners() {
    selectionListeners.forEach(fn => fn());
}

function updateHighlightStyles() {
    if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "multi-forward-highlight";
        document.head.appendChild(styleEl);
    }
    if (selectedMessages.size === 0) {
        styleEl.textContent = "";
        return;
    }
    const selectors = [...selectedMessages.keys()]
        .map(id => `li[id$="-${id}"]`)
        .join(", ");
    styleEl.textContent = `${selectors} { background: hsl(235, 85.6%, 64.7%, 0.2) !important; outline: 1px solid hsl(235, 85.6%, 64.7%, 0.5); border-radius: 4px; }`;
}
function isSelected(id: string) {
    return selectedMessages.has(id);
}

function toggleMessage(msg: Message) {
    if (selectedMessages.has(msg.id)) {
        selectedMessages.delete(msg.id);
    } else {
        selectedMessages.set(msg.id, msg);
    }
    updateHighlightStyles();
    notifyListeners();
}

function clearSelection() {
    selectedMessages.clear();
    updateHighlightStyles();
    notifyListeners();
}

// --- Chat bar button ---

function ForwardIcon() {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M14 3L21 10L14 17V13C9 13 5.5 15 3 19C4 14 7 9 14 7V3Z" fill="currentColor" />
        </svg>
    );
}

function ForwardChatBarButton() {
    const [count, setCount] = useState(selectedMessages.size);

    useEffect(() => {
        const update = () => setCount(selectedMessages.size);
        selectionListeners.add(update);
        return () => { selectionListeners.delete(update); };
    }, []);

    if (count === 0) return null;

    function handleClick() {
        const channelId = SelectedChannelStore.getChannelId();
        if (!channelId) return;
        const messages = [...selectedMessages.values()];
        openModal(props => (
            <ConfirmModal
                {...props}
                title={`Forward ${count} message${count !== 1 ? "s" : ""}`}
                confirmText="Forward"
                onConfirm={async () => {
                    await forwardMessagesToChannels(messages, [channelId]);
                    clearSelection();
                    showToast(`Forwarded ${messages.length} message${messages.length !== 1 ? "s" : ""}`, Toasts.Type.SUCCESS);
                }}
            >
                Forward {count} message{count !== 1 ? "s" : ""} to this channel?
            </ConfirmModal>
        ));
    }

    return (
        <ChatBarButton
            tooltip={`Forward ${count} selected message${count !== 1 ? "s" : ""} to this channel`}
            onClick={handleClick}
            onContextMenu={() => openQueueModal()}
        >
            <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ForwardIcon />
                <div style={{
                    position: "absolute", top: -6, right: -8,
                    background: "var(--brand-experiment)",
                    color: "white", borderRadius: "50%",
                    width: 16, height: 16, fontSize: 10,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 700, lineHeight: 1,
                }}>
                    {count}
                </div>
            </div>
        </ChatBarButton>
    );
}

// --- Channel options ---

interface ChannelOption {
    label: string;
    value: string;
    subtext?: string;
}

// --- Forward logic ---

async function forwardMessagesToChannels(messages: Message[], channelIds: string[]) {
    const sorted = [...messages].sort((a, b) => (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0));

    for (const channelId of channelIds) {
        for (const msg of sorted) {
            await RestAPI.post({
                url: `/channels/${channelId}/messages`,
                body: {
                    message_reference: {
                        type: 1,
                        message_id: msg.id,
                        channel_id: msg.channel_id,
                        guild_id: ChannelStore.getChannel(msg.channel_id)?.guild_id,
                    },
                },
            });
            sleep(800);
        }
    }
}

// --- Queue modal (view / remove selected messages) ---

function QueueModal({ props }: { props: RenderModalProps; }) {
    const [messages, setMessages] = useState([...selectedMessages.values()]);

    function remove(id: string) {
        selectedMessages.delete(id);
        updateHighlightStyles();
        notifyListeners();
        setMessages([...selectedMessages.values()]);
    }

    return (
        <Modal
            {...props}
            title={`Forward Queue (${messages.length})`}
            actions={[
                {
                    text: "Clear All",
                    variant: "destructive",
                    onClick: () => { clearSelection(); props.onClose(); },
                },
                { text: "Close", variant: "secondary", onClick: () => props.onClose() },
            ]}
        >
            {messages.length === 0 && (
                <div style={{ color: "var(--text-muted)", textAlign: "center", padding: 24, fontSize: 14 }}>
                    No messages selected
                </div>
            )}
            {messages.map(msg => (
                <div key={msg.id} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "6px 4px", borderBottom: "1px solid var(--background-modifier-accent)",
                }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: "var(--text-muted)", fontSize: 11 }}>
                            {UserStore.getUser(msg.author.id)?.username ?? msg.author.id}
                        </div>
                        <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 4 }}>
                            {msg.content && <span style={{ color: "var(--text-normal)" }}>{msg.content}</span>}
                            {msg.attachments?.length > 0 && (() => {
                                const attachments = Array.from(msg.attachments as any) as any[];
                                const images = attachments.filter(a =>
                                    a.content_type?.startsWith("image/") || /\.(png|jpe?g|gif|webp)$/i.test(a.filename)
                                );
                                const others = attachments.filter(a => !images.includes(a));
                                return <>
                                    {images.length > 0 && (
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                            {images.map((a: any) => (
                                                <img
                                                    key={a.id}
                                                    src={a.proxy_url}
                                                    alt={a.filename}
                                                    title={a.filename}
                                                    onClick={e => { e.stopPropagation(); openMediaModal({ items: [{ url: a.url, type: "IMAGE", original: a.url, width: a.width, height: a.height }] }); }}
                                                    style={{ maxHeight: 60, maxWidth: 100, borderRadius: 4, cursor: "zoom-in", objectFit: "cover" }}
                                                />
                                            ))}
                                        </div>
                                    )}
                                    {others.length > 0 && (
                                        <div style={{ color: "var(--text-muted)" }}>
                                            {others.map((a: any) => (
                                                <span key={a.id} style={{ display: "inline-flex", alignItems: "center", gap: 2, marginRight: 6 }}>
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h5v7h7v9H6z" /></svg>
                                                    {a.filename}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </>;
                            })()}
                        </div>
                    </div>
                    <Button
                        variant="link"
                        size="iconOnly"
                        onClick={() => {
                            const guildId = ChannelStore.getChannel(msg.channel_id)?.guild_id ?? "@me";
                            NavigationRouter.transitionTo(`/channels/${guildId}/${msg.channel_id}/${msg.id}`);
                        }}
                        title="Jump to message"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M10 6V8H5V19H16V14H18V20C18 20.5523 17.5523 21 17 21H4C3.44772 21 3 20.5523 3 20V7C3 6.44772 3.44772 6 4 6H10ZM21 3V11H19L18.9999 6.413L11.2071 14.2071L9.79289 12.7929L17.5849 5H13V3H21Z" />
                        </svg>
                    </Button>
                    <Button
                        variant="dangerSecondary"
                        size="iconOnly"
                        onClick={() => remove(msg.id)}
                        title="Remove"
                    >×</Button>
                </div>
            ))}
        </Modal>
    );
}

function openQueueModal() {
    openModal(props => <QueueModal props={props} />);
}

// --- Context menu patch ---

const messageCtxPatch: NavContextMenuPatchCallback = (children, { message }: { message: Message; }) => {
    if (!message?.id) return;

    const group =
        findGroupChildrenByChildId("forward", children) ??
        findGroupChildrenByChildId("reply", children) ??
        findGroupChildrenByChildId("copy-text", children) ??
        findGroupChildrenByChildId("delete", children);

    if (!group) return;

    const selected = isSelected(message.id);

    group.push(
        <Menu.MenuItem
            id="multi-forward-toggle"
            label={selected ? `Deselect (${selectedMessages.size} selected)` : "Select for Multi-Forward"}
            action={() => toggleMessage(message)}
        />
    );

    if (selectedMessages.size > 0) {
        group.push(
            <Menu.MenuItem
                id="multi-forward-queue"
                label={`View Queue (${selectedMessages.size})`}
                action={() => openQueueModal()}
            />
        );
    }
};

export default definePlugin({
    name: "MultipleForward",
    description: "Select multiple messages and forward them all at once to any channel or DM",
    authors: [EquicordDevs.windowsed],
    dependencies: ["ChatInputButtonAPI"],
    tags: ["Chat", "Utility"],
    contextMenus: {
        "message": messageCtxPatch,
    },

    start() {
        addChatBarButton("MultipleForward", () => <ForwardChatBarButton />, ForwardIcon);
    },

    stop() {
        removeChatBarButton("MultipleForward");
        clearSelection();
        styleEl?.remove();
        styleEl = null;
    },
});
