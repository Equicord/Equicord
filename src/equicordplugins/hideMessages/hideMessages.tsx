/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { DataStore } from "@api/index";
import { updateMessage } from "@api/MessageUpdater";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { type IconComponent, type IconProps } from "@utils/types";
import { type Message } from "@vencord/discord-types";
import { ChannelStore, Menu, React } from "@webpack/common";

type HiddenMessageEntry = {
    id: string;
    channelId: string;
    preview: string;
};

type MessagePreviewSource = Message & {
    attachments?: Array<{ filename?: string | null; }>;
    stickerItems?: Array<{ name?: string | null; }>;
    sticker_items?: Array<{ name?: string | null; }>;
    stickers?: Array<{ name?: string | null; }>;
};

const hiddenMessages = new Map<string, HiddenMessageEntry>();
const recentHiddenMessages: HiddenMessageEntry[] = [];
let lastUnhiddenMessage: HiddenMessageEntry | null = null;
const HIDDEN_STORE_KEY = "HideMessage.hiddenMessages";
const HISTORY_STORE_KEY = "HideMessage.recentHiddenMessages";
const HISTORY_LIMIT = 24;
type InlineIconProps = { className?: string; width?: number; height?: number; };

function InlineEyeIcon({ className, width = 20, height = 20 }: InlineIconProps) {
    return (
        <svg className={className} width={width} height={height} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" stroke="currentColor" strokeWidth="2" />
            <circle cx="12" cy="12" r="3" fill="currentColor" />
        </svg>
    );
}

function InlineHideIcon({ className, width = 20, height = 20 }: InlineIconProps) {
    return (
        <svg className={className} width={width} height={height} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" stroke="currentColor" strokeWidth="2" />
            <circle cx="12" cy="12" r="3" fill="currentColor" />
            <path d="M4 20 20 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
    );
}

function InlineArrowAngleLeftDownIcon({ className, width = 20, height = 20 }: InlineIconProps) {
    return (
        <svg className={className} width={width} height={height} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M17 7v7h-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="m17 14-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
    );
}

function InlineEyeDropperIcon({ className, width = 20, height = 20 }: InlineIconProps) {
    return (
        <svg className={className} width={width} height={height} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m14 4 6 6-2 2-6-6 2-2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <path d="m11 7 6 6-7.5 7.5H5v-4.5L11 7Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
    );
}

function toNumericSize(size: string | number | undefined) {
    return typeof size === "number" ? size : void 0;
}

function wrapIcon(Component: (props: InlineIconProps) => React.ReactNode): IconComponent {
    return ({ className, width, height }: IconProps) => (
        <Component className={className} width={toNumericSize(width)} height={toNumericSize(height)} />
    );
}

function makeOverlayEyeIcon(Overlay: (props: InlineIconProps) => React.ReactNode, scale: number): IconComponent {
    return ({ className, width, height, ...rest }: IconProps & Record<string, unknown>) => {
        const size = { width: toNumericSize(width), height: toNumericSize(height) };
        return (
            <span className={className} style={{ position: "relative", display: "inline-flex" }}>
                <InlineEyeIcon {...size} {...rest} />
                <span style={{ position: "absolute", right: -2, bottom: -2, transform: `scale(${scale})` }}>
                    <Overlay {...size} {...rest} />
                </span>
            </span>
        );
    };
}

const HideMenuIcon = wrapIcon(InlineHideIcon);
const MenuRevealIcon = wrapIcon(InlineEyeIcon);

const UnhideAllMessagesIcon = makeOverlayEyeIcon(InlineArrowAngleLeftDownIcon, 0.6);
const RedoPreviousMessageIcon = makeOverlayEyeIcon(InlineEyeDropperIcon, 0.7);

function syncRecentHidden(entry: HiddenMessageEntry) {
    const index = recentHiddenMessages.findIndex(m => m.id === entry.id);
    if (index !== -1) recentHiddenMessages.splice(index, 1);
    recentHiddenMessages.unshift(entry);
    if (recentHiddenMessages.length > HISTORY_LIMIT) recentHiddenMessages.length = HISTORY_LIMIT;
}

function persistState() {
    void DataStore.set(HIDDEN_STORE_KEY, [...hiddenMessages.values()]);
    void DataStore.set(HISTORY_STORE_KEY, recentHiddenMessages);
}

function updateHiddenMessage(entry: HiddenMessageEntry, hidden: boolean, preserveHistoryOrder = false, rememberUnhidden = true) {
    if (hidden) {
        hiddenMessages.set(entry.id, entry);
        if (!preserveHistoryOrder) syncRecentHidden(entry);
    } else {
        if (rememberUnhidden) lastUnhiddenMessage = entry;
        hiddenMessages.delete(entry.id);
    }

    updateMessage(entry.channelId, entry.id);
    persistState();
}

function isStoredEntry(value: unknown): value is HiddenMessageEntry {
    if (!value || typeof value !== "object") return false;
    const entry = value as Record<string, unknown>;
    return typeof entry.id === "string"
        && typeof entry.channelId === "string"
        && typeof entry.preview === "string";
}

async function restoreState() {
    const [storedHidden, storedHistory] = await Promise.all([
        DataStore.get<unknown[]>(HIDDEN_STORE_KEY),
        DataStore.get<unknown[]>(HISTORY_STORE_KEY),
    ]);

    hiddenMessages.clear();
    recentHiddenMessages.length = 0;

    for (const entry of (storedHidden ?? []).filter(isStoredEntry)) hiddenMessages.set(entry.id, entry);
    for (const entry of (storedHistory ?? []).filter(isStoredEntry)) syncRecentHidden(entry);
}

function getMessagePreview(msg: Message) {
    const source = msg as MessagePreviewSource;
    const content = typeof msg.content === "string" ? msg.content.trim() : "";
    if (content.length > 0) {
        const normalized = content.replace(/<a?:([^:>]+):\d+>/g, ":$1:");
        return normalized.length > 96 ? `${normalized.slice(0, 96)}...` : normalized;
    }

    const attachment = source.attachments?.find(a => typeof a.filename === "string");
    if (attachment) {
        const attachmentName = (attachment.filename ?? "").trim();
        if (attachmentName.length > 0) return `Attachment: ${attachmentName}`;
    }

    const sticker = source.stickerItems?.[0] ?? source.sticker_items?.[0] ?? source.stickers?.[0];
    if (sticker?.name) return `Sticker: ${sticker.name}`;

    return `Message ${msg.id.slice(-6)}`;
}

function toggleHidden(msg: Message) {
    if (hiddenMessages.has(msg.id)) {
        const hidden = hiddenMessages.get(msg.id);
        if (hidden) updateHiddenMessage(hidden, false, false, false);
        return;
    }

    const entry = {
        id: msg.id,
        channelId: msg.channel_id,
        preview: getMessagePreview(msg),
    };
    updateHiddenMessage(entry, true);
}

function unhideAllMessages() {
    const entries = [...hiddenMessages.values()];
    if (entries.length > 0) lastUnhiddenMessage = entries[entries.length - 1];
    hiddenMessages.clear();

    for (const entry of entries) updateMessage(entry.channelId, entry.id);
    persistState();
}

function redoPreviousMessage() {
    const previous = lastUnhiddenMessage;
    if (!previous || hiddenMessages.has(previous.id)) return;

    updateHiddenMessage(previous, true);
}

const messageContextMenuPatch: NavContextMenuPatchCallback = (children, { message }: { message: Message; }) => {
    const hiddenEntries = recentHiddenMessages.slice(0, 12);
    const [checkedById, setCheckedById] = React.useState<Record<string, boolean>>({});
    children.push(
        <Menu.MenuItem
            id="vc-hide-message"
            label="Hide Message"
            icon={HideMenuIcon}
            color="danger"
            action={() => toggleHidden(message)}
        >
            {hiddenMessages.size > 0 && (
                <>
            <Menu.MenuItem
                key="vc-hide-message-hidden-list"
                id="vc-hide-message-hidden-list"
                label={`Hidden Messages (${hiddenMessages.size})`}
                icon={HideMenuIcon}
            >
                {hiddenEntries.map(entry => (
                    <Menu.MenuCheckboxItem
                        key={`vc-hide-message-unhide-${entry.id}`}
                        id={`vc-hide-message-unhide-${entry.id}`}
                        label={entry.preview}
                        checked={checkedById[entry.id] ?? hiddenMessages.has(entry.id)}
                        icon={MenuRevealIcon}
                        action={() => {
                            const hidden = hiddenMessages.get(entry.id);
                            const next = hidden == null;
                            updateHiddenMessage(hidden ?? entry, next, true);
                            setCheckedById(prev => ({ ...prev, [entry.id]: next }));
                        }}
                    />
                ))}
            </Menu.MenuItem>
            <Menu.MenuItem
                key="vc-hide-message-unhide-all"
                id="vc-hide-message-unhide-all"
                label="Unhide All Messages"
                icon={UnhideAllMessagesIcon}
                action={unhideAllMessages}
            />
            <Menu.MenuItem
                key="vc-hide-message-undo-previous"
                id="vc-hide-message-undo-previous"
                label="Undo Previous Message"
                icon={MenuRevealIcon}
                disabled={hiddenMessages.size === 0}
                action={() => {
                    const previous = [...hiddenMessages.values()].at(-1);
                    if (previous) updateHiddenMessage(previous, false);
                }}
            />
            <Menu.MenuItem
                key="vc-hide-message-redo-previous"
                id="vc-hide-message-redo-previous"
                label="Redo Previous Message"
                icon={RedoPreviousMessageIcon}
                disabled={lastUnhiddenMessage == null || hiddenMessages.has(lastUnhiddenMessage.id)}
                action={redoPreviousMessage}
            />
                </>
            )}
        </Menu.MenuItem>
    );
};

export default definePlugin({
    name: "HideMessages",
    description: "Hide messages you don’t want to see and manage them from the message context menu.",
    authors: [EquicordDevs.omaw],
    dependencies: ["MessageUpdaterAPI"],

    patches: [
        {
            find: "Message must not be a thread starter message",
            replacement: {
                match: /(\i\.memo\(function\((\i)\)\{)/,
                replace: "$1if($self.isHidden($2?.message?.id))return null;",
            },
        }
    ],

    isHidden(id: string | undefined): boolean {
        return id !== undefined && hiddenMessages.has(id);
    },

    messagePopoverButton: {
        icon: HideMenuIcon,
        render(msg: Message) {
            return {
                label: "Hide Message",
                icon: HideMenuIcon,
                message: msg,
                channel: ChannelStore.getChannel(msg.channel_id),
                onClick: () => toggleHidden(msg),
            };
        }
    },

    contextMenus: {
        "message": messageContextMenuPatch,
    },

    start() {
        void restoreState();
    },

    stop() {
        hiddenMessages.clear();
        recentHiddenMessages.length = 0;
        lastUnhiddenMessage = null;
    },
});