/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { closeModal, ModalRoot, ModalSize, openModal } from "@utils/modal";
import definePlugin from "@utils/types";
import { ChannelStore } from "@webpack/common";

import { DuelAccessory } from "./components/DuelAccessory";
import { Overlay } from "./components/Overlay";
import managedStyle from "./styles.css?managed";
import { type OpenGamePayload, setOpenGameRef } from "./utils/launcher";

const cl = classNameFactory("emoji-pong-");
let modalKey: string | null = null;
let lastEmojiKey: string | null = null;
let lastClickAt = 0;
let clickCount = 0;

const TRIPLE_CLICK_WINDOW_MS = 450;
type StartEmojiWithContext = OpenGamePayload & {
    channelId?: string;
    contextId?: string;
    messageId?: string;
};
type SimpleEmoji = { type: "text"; value: string; } | { type: "image"; url: string; alt?: string; };
const SNOWFLAKE_PATTERN = /^\d{17,20}$/;
type ClickEventLike = {
    preventDefault: () => void;
    stopPropagation: () => void;
    target: EventTarget | null;
    nativeEvent?: Event;
    stopImmediatePropagation?: () => void;
};

let openGame: ((emoji: StartEmojiWithContext) => void) | null = null;

function closeGameModal() {
    if (!modalKey) return;
    const key = modalKey;
    modalKey = null;
    closeModal(key);
}

function openGameModal(startEmoji: StartEmojiWithContext) {
    closeGameModal();
    modalKey = openModal(modalProps => (
        <ModalRoot {...modalProps} size={ModalSize.DYNAMIC} className={cl("modal")}>
            <Overlay onClose={closeGameModal} startEmoji={startEmoji} />
        </ModalRoot>
    ), {
        onCloseCallback: () => {
            modalKey = null;
        }
    });
}

const ALLOWED_EMOJI_PREFIXES = [
    "https://cdn.discordapp.com/emojis/",
    "https://discord.com/assets/"
];

function toSafeUrl(raw: string | null): string | null {
    if (!raw) return null;
    try {
        const url = new URL(raw, "https://discord.com");
        if (url.protocol !== "https:") return null;
        url.search = "";
        url.hash = "";
        const normalized = url.toString();
        if (!ALLOWED_EMOJI_PREFIXES.some(prefix => normalized.startsWith(prefix))) return null;
        return normalized;
    } catch {
        return null;
    }
}

function getEmojiFromNode(node: Element | null): SimpleEmoji | null {
    if (!node) return null;
    if (node instanceof HTMLImageElement) {
        const alt = node.getAttribute("alt");
        const src = toSafeUrl(node.getAttribute("src"));
        if (src) return { type: "image", url: src, alt: alt ?? undefined };
        if (alt && alt.trim().length > 0) return { type: "text", value: alt.trim() };
        return null;
    }
    const text = node.textContent?.trim();
    return text && text.length > 0 ? { type: "text", value: text } : null;
}

function isValidSnowflake(value: unknown): value is string {
    return typeof value === "string" && SNOWFLAKE_PATTERN.test(value);
}

function normalizeStartEmoji(payload: unknown): StartEmojiWithContext | null {
    if (!payload || typeof payload !== "object") return null;
    const source = payload as Record<string, unknown>;
    const channelId = isValidSnowflake(source.channelId) ? source.channelId : undefined;
    const contextId = isValidSnowflake(source.contextId) ? source.contextId : undefined;
    const messageId = isValidSnowflake(source.messageId) ? source.messageId : undefined;
    const duelSource = source.duel;
    let duel: StartEmojiWithContext["duel"] | undefined;
    if (duelSource && typeof duelSource === "object") {
        const duelObj = duelSource as Record<string, unknown>;
        const opponentId = isValidSnowflake(duelObj.opponentId) ? duelObj.opponentId : null;
        const opponentScore = typeof duelObj.opponentScore === "number" && Number.isFinite(duelObj.opponentScore) ? Math.trunc(duelObj.opponentScore) : null;
        const viewerScore = typeof duelObj.viewerScore === "number" && Number.isFinite(duelObj.viewerScore) ? Math.trunc(duelObj.viewerScore) : null;
        if (opponentId && opponentScore != null && viewerScore != null && opponentScore >= 0 && viewerScore >= 0) {
            duel = {
                opponentId,
                opponentScore,
                viewerScore
            };
        }
    }
    if (source.type === "text" && typeof source.value === "string") {
        const value = source.value.trim();
        if (value.length < 1 || value.length > 32) return null;
        return { type: "text", value, channelId, contextId, messageId, duel };
    }
    if (source.type === "image" && typeof source.url === "string") {
        const url = toSafeUrl(source.url);
        if (!url) return null;
        const alt = typeof source.alt === "string" ? source.alt.trim().slice(0, 64) : undefined;
        return { type: "image", url, alt: alt && alt.length > 0 ? alt : undefined, channelId, contextId, messageId, duel };
    }
    return null;
}

function getEmojiKey(node: Element): string | null {
    if (node instanceof HTMLImageElement) {
        return node.getAttribute("data-id")
            ?? node.getAttribute("src")
            ?? node.getAttribute("alt");
    }
    return node.textContent?.trim() ?? null;
}

function getChatEmojiClick(event: MouseEvent): StartEmojiWithContext | null {
    const target = event.target as HTMLElement | null;
    if (!target?.closest) return null;
    const emojiNode = target.closest("img.emoji, span.emoji");
    if (!emojiNode) return null;
    const messageRoot = emojiNode.closest("[id^='message-content'], [class*='messageContent'], [class*='message-content']");
    if (!messageRoot) return null;
    const pickerAncestor = emojiNode.closest(
        "[data-list-id='emoji-picker'], [class*='emojiPicker'], [class*='emoji-picker'], [aria-label*='Emoji'], [aria-label*='emoji']"
    );
    if (pickerAncestor) return null;
    const row = emojiNode.closest("li[id^='chat-messages-']");
    const rowMatch = row?.id ? row.id.match(/^chat-messages-(\\d+)-(\\d+)$/) : null;
    const channelId = rowMatch?.[1];
    const messageId = rowMatch?.[2];
    const isCustomEmoji = emojiNode instanceof HTMLElement && emojiNode.hasAttribute("data-id");
    if (!isCustomEmoji) {
        const isJumboEmoji = emojiNode instanceof HTMLElement && emojiNode.classList.contains("jumboable");
        if (!isJumboEmoji) return null;
    }
    const emoji = getEmojiFromNode(emojiNode);
    if (!emoji) return null;
    if (!channelId || !messageId) return emoji;
    const channel = ChannelStore.getChannel(channelId);
    const contextId = channel?.guild_id ?? channel?.id;
    return { ...emoji, channelId, contextId, messageId };
}

function getNativeMouseEvent(event: ClickEventLike): MouseEvent | null {
    const candidate = event instanceof MouseEvent ? event : event.nativeEvent;
    return candidate instanceof MouseEvent ? candidate : null;
}

function stopImmediate(event: ClickEventLike) {
    if (typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
        return;
    }
    if (event.nativeEvent && "stopImmediatePropagation" in event.nativeEvent && typeof event.nativeEvent.stopImmediatePropagation === "function") {
        event.nativeEvent.stopImmediatePropagation();
    }
}

export default definePlugin({
    name: "Equipong",
    description: "Tap a single emoji message to launch a swipe-to-score mini game.",
    authors: [EquicordDevs.omaw],
    managedStyle,
    renderMessageAccessory: props => <DuelAccessory message={props.message} />,
    patches: [
        {
            find: "emojiNode:t",
            replacement: {
                match: /onClick:(\i)=>\{g\(!0\),(\i)\?\.onClick\?\.\(\1\)\}/,
                replace: "onClick:$1=>{g(!0),$self.registerChatEmojiTap($1),$2?.onClick?.($1)}"
            }
        },
        {
            find: "triggerHandlers:s,describedById:o,triggerRef:l",
            replacement: {
                match: /onClick:s\.onClick/,
                replace: "onClick:$self.chainEmojiClick(s.onClick)"
            }
        },
        {
            find: "Unknown Src for Emoji",
            replacement: {
                match: /"data-type":"emoji"/,
                replace: "onClick:$self.chainEmojiClick(D.onClick),\"data-type\":\"emoji\""
            }
        }
    ],
    start() {
        openGame = (emoji: StartEmojiWithContext) => {
            const normalized = normalizeStartEmoji(emoji);
            if (!normalized) return;
            openGameModal(normalized);
        };
        setOpenGameRef(openGame);
    },
    stop() {
        closeGameModal();
        openGame = null;
        setOpenGameRef(null);
    },
    registerChatEmojiTap(event: MouseEvent): boolean {
        const emoji = getChatEmojiClick(event);
        if (!emoji) return false;
        const emojiNode = (event.target as HTMLElement | null)?.closest?.("img.emoji, span.emoji");
        if (!emojiNode) return false;
        const key = getEmojiKey(emojiNode);
        const now = performance.now();
        if (!key || key !== lastEmojiKey || now - lastClickAt > TRIPLE_CLICK_WINDOW_MS) {
            lastEmojiKey = key;
            clickCount = 0;
        }
        lastClickAt = now;
        clickCount += 1;
        if (clickCount < 3) return false;
        clickCount = 0;
        if (!openGame) return false;
        openGame(emoji);
        return true;
    },
    chainEmojiClick(handler?: (event: ClickEventLike) => void) {
        return (event: ClickEventLike) => {
            const mouseEvent = getNativeMouseEvent(event);
            const opened = mouseEvent ? this.registerChatEmojiTap(mouseEvent) : false;
            if (opened) {
                event.preventDefault();
                event.stopPropagation();
                stopImmediate(event);
                return;
            }
            handler?.(event);
        };
    }
});
