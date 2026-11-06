/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { plugins } from "@api/PluginManager";
import { definePluginSettings } from "@api/Settings";
import { HistoryIcon } from "@components/Icons";
import { openPluginModal } from "@components/settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { ChannelMessages } from "@vencord/discord-types";
import { findStoreLazy } from "@webpack";
import { ChannelStore, ContextMenuApi, Menu, MessageStore, ReadStateStore, SnowflakeUtils, UserStore, useStateFromStores } from "@webpack/common";

import { historyStorage, SavedPosition } from "./history";
import { HistoryControls } from "./HistoryControls";

interface GuardedMessages extends ChannelMessages {
    readonly betterBackreadingTrimGuard?: boolean;
}

interface ScrollAnchor {
    id: string;
    offsetTop: number;
    offsetFromTop: number;
    offsetHeight: number;
}

interface ScrollManager {
    props: { messages: GuardedMessages; };
    ref: { current: { getScrollerNode(): HTMLElement | null; } | null; };
    messageFetchAnchor: ScrollAnchor | null;
    automaticAnchor: ScrollAnchor | null;
    isInitialized(): boolean;
    isJumping(): boolean;
    isLoading(): boolean;
    isScrolledToBottom(): boolean;
    setScrollToBottom(): void;
    getScrollerState(): { scrollTop: number; scrollHeight: number; offsetHeight: number; };
    getAnchorData(id: string, scrollTop: number): ScrollAnchor | null;
}

interface OpeningPosition {
    messageId: string;
    saved?: SavedPosition;
    onJumpComplete?: () => void;
}

interface ChannelOpenOptions {
    channelId?: string;
    messageId?: string | null;
    isPreload?: boolean;
}

const scrollManagers = new Set<ScrollManager>();
const DimensionStore = findStoreLazy("DimensionStore");
const openingPositions = new Map<string, OpeningPosition>();
const pausedChannels = new Set<string>();
const progressChannels = new Set<string>();
const deferredOpens = new Map<string, ChannelOpenOptions>();
const replayedOpens = new WeakSet<ChannelOpenOptions>();
let accountId: string | null = null;
let accountGeneration = 0;
let historyLoad: Promise<void> = Promise.resolve();

function currentAccount() {
    return UserStore?.getCurrentUser()?.id ?? null;
}

function newerMessage(first?: string | null, second?: string | null) {
    if (!first) {
        return second ?? undefined;
    }

    if (!second) {
        return first;
    }

    return SnowflakeUtils.compare(first, second) >= 0 ? first : second;
}

async function clearSavedHistory() {
    if (!accountId || accountId !== currentAccount() || !historyStorage.isReady(accountId)) {
        throw new Error("Saved history is not available yet.");
    }

    openingPositions.clear();
    deferredOpens.clear();
    progressChannels.clear();

    for (const manager of scrollManagers) {
        pausedChannels.add(manager.props.messages.channelId);
    }

    await historyStorage.clear();
}

const settings = definePluginSettings({
    imageScrollMargin: {
        type: OptionType.STRING,
        displayName: "Image Preload Distance",
        description: "How far ahead to load images, in pixels (300-3000).",
        default: "1500",
        isValid: value => validateInteger(value, 300, 3000),
        restartNeeded: true
    },
    messageLoadBuffer: {
        type: OptionType.STRING,
        displayName: "Message Load Buffer",
        description: "How far ahead to fetch more messages, in pixels (500-3000).",
        default: "1500",
        isValid: value => validateInteger(value, 500, 3000),
        restartNeeded: true
    },
    useDiscordMessageCount: {
        type: OptionType.BOOLEAN,
        displayName: "Use Discord's Dynamic Message Count",
        description: "Let Discord choose how many messages to fetch based on your window and chat settings.",
        default: true
    },
    messageCount: {
        type: OptionType.STRING,
        displayName: "Custom Message Count",
        description: "How many messages to fetch per history request when the dynamic count is disabled (30-100).",
        default: "50",
        isValid: value => validateInteger(value, 30, 100)
    },
    channelOpenScrollMode: {
        type: OptionType.SELECT,
        displayName: "Channel Opening Position",
        description: "Where in the chat history to open channels. If you leave within 5 messages of the latest, \"Saved Position\" is considered unset and the next fallback is used. If your last-read message is older than the maximum age below, the channel is considered abandoned and \"Oldest Unread\" is considered unset.",
        options: [
            { label: "Saved Position > Latest Message", value: "savedLatest" },
            { label: "Saved Position > Oldest Unread > Latest Message", value: "saved", default: true },
            { label: "Oldest Unread > Latest Message", value: "unread" },
            { label: "Latest Message", value: "bottom" },
            { label: "Discord Default", value: "default" }
        ]
    },
    maximumLastReadAge: {
        type: OptionType.STRING,
        displayName: "Maximum Last-Read Age",
        description: "Maximum age of your last-read message, in minutes, to use the \"Oldest Unread\" fallback. Set to 0 for unlimited.",
        default: "10080",
        isValid: value => validateInteger(value, 0, 5256000)
    },
    showJumpToPresentSooner: {
        type: OptionType.BOOLEAN,
        displayName: "Show Jump To Present Button Sooner",
        description: "Shows the Jump To Present button when scrolled 5 or more messages above the latest.",
        default: true
    },
    addChatbarButton: {
        type: OptionType.BOOLEAN,
        displayName: "Add Chatbar Button",
        description: "Adds a chatbar button to quickly switch channel opening position.",
        default: false
    },
    clearSavedHistory: {
        type: OptionType.COMPONENT,
        component: () => <HistoryControls onClear={clearSavedHistory} />
    }
}, {
    messageCount: {
        disabled() {
            return this.store.useDiscordMessageCount;
        }
    },
    maximumLastReadAge: {
        disabled() {
            return this.store.channelOpenScrollMode !== "saved" && this.store.channelOpenScrollMode !== "unread";
        }
    }
});

/** Select the global opening mode without moving the current chat view. */
function ChannelOpeningMenu() {
    const { channelOpenScrollMode } = settings.use(["channelOpenScrollMode"]);

    return (
        <Menu.Menu navId="betterbackreading-opening-position" aria-label="Channel Opening Position" onClose={ContextMenuApi.closeContextMenu}>
            {settings.def.channelOpenScrollMode.options.map(option => (
                <Menu.MenuRadioItem
                    key={option.value}
                    id={`betterbackreading-opening-${option.value}`}
                    group="betterbackreading-opening-position"
                    label={option.label}
                    checked={channelOpenScrollMode === option.value}
                    action={() => settings.store.channelOpenScrollMode = option.value}
                />
            ))}
        </Menu.Menu>
    );
}

/** Open the channel-position selector from a main or sidebar chat composer. */
const OpeningPositionButton: ChatBarButtonFactory = ({ isAnyChat }) => {
    const { addChatbarButton, channelOpenScrollMode } = settings.use(["addChatbarButton", "channelOpenScrollMode"]);

    if (!isAnyChat || !addChatbarButton) {
        return null;
    }

    const selected = settings.def.channelOpenScrollMode.options.find(option => option.value === channelOpenScrollMode);

    return (
        <ChatBarButton
            tooltip={selected?.label ?? "Discord Default"}
            tooltipClassName="vc-betterbackreading-tooltip"
            buttonProps={{ "aria-haspopup": "menu" }}
            onClick={event => ContextMenuApi.openContextMenu(event, () => <ChannelOpeningMenu />)}
            onAuxClick={event => {
                if (event.button !== 1) {
                    return;
                }

                event.preventDefault();
                event.stopPropagation();
                openPluginModal(plugins.BetterBackreading);
            }}
        >
            <HistoryIcon width={20} height={20} />
        </ChatBarButton>
    );
};

function validateInteger(value: unknown, min: number, max: number) {
    const parsedValue = Number(value);

    return Number.isInteger(parsedValue) && parsedValue >= min && parsedValue <= max || `Enter a whole number from ${min} to ${max}.`;
}

function boundedInteger(value: string | number, min: number, max: number, fallback: number) {
    const parsedValue = Number(value);

    return Math.min(max, Math.max(min, Math.round(Number.isFinite(parsedValue) ? parsedValue : fallback)));
}

function getCustomMessageCount() {
    return boundedInteger(settings.store.messageCount, 30, 100, 50);
}

function ensureHistory() {
    const userId = currentAccount();

    if (userId !== accountId) {
        accountGeneration++;
        accountId = userId;
        openingPositions.clear();
        deferredOpens.clear();
        pausedChannels.clear();
        progressChannels.clear();
        scrollManagers.clear();
        historyLoad = historyStorage.load(userId);
    }

    return historyLoad;
}

function flushHistory(): void {
    for (const manager of scrollManagers) {
        savePosition(manager);
    }

    // Storage failures are logged by the history store and retried on the next save.
    void historyStorage.flush().catch(() => { });
}

function pauseHistory(): void {
    flushHistory();
    progressChannels.clear();
}

function deleteChannelHistory(channelId: string) {
    ensureHistory();
    const generation = accountGeneration;
    openingPositions.delete(channelId);
    deferredOpens.delete(channelId);
    progressChannels.delete(channelId);
    pausedChannels.add(channelId);

    const remove = () => {
        if (generation === accountGeneration) {
            historyStorage.delete(channelId);
        }
    };

    if (accountId && historyStorage.isReady(accountId)) {
        remove();
    } else {
        void historyLoad.then(remove);
    }
}

function syncAcknowledgement(channelId: string, messageId?: string, manual = false) {
    ensureHistory();
    const userId = accountId;
    const generation = accountGeneration;

    const apply = () => {
        if (generation !== accountGeneration || !userId || userId !== accountId || !historyStorage.isReady(userId)) {
            return;
        }

        const record = historyStorage.get(channelId);

        if (manual) {
            openingPositions.delete(channelId);
            deferredOpens.delete(channelId);
            progressChannels.delete(channelId);
            pausedChannels.add(channelId);
            historyStorage.set(channelId, { readThroughMessageId: messageId, updatedAt: Date.now() });
        } else if (record?.readThroughMessageId && messageId && newerMessage(messageId, record.readThroughMessageId) === messageId) {
            delete record.readThroughMessageId;

            if (record.view) {
                historyStorage.set(channelId, record);
            } else {
                historyStorage.delete(channelId);
            }
        }
    };

    if (userId && historyStorage.isReady(userId)) {
        apply();
    } else {
        void historyLoad.then(apply);
    }
}

function savePosition(manager: ScrollManager) {
    const { messages } = manager.props;

    if (!accountId || accountId !== currentAccount() || !historyStorage.isReady(accountId) || pausedChannels.has(messages.channelId)) {
        return;
    }

    if (!isActive(manager) || !manager.isInitialized() || manager.isJumping() || manager.isLoading() || !messages.ready || messages.error) {
        return;
    }

    if (openingPositions.has(messages.channelId)) {
        return;
    }

    const { scrollTop, offsetHeight } = manager.getScrollerState();

    if (!manager.ref.current?.getScrollerNode()?.getClientRects().length || offsetHeight <= 0) {
        return;
    }

    let view: SavedPosition | null = null;
    let readThrough: string | undefined;
    let lastVisibleIndex = -1;

    for (let index = 0; index < messages._array.length; index++) {
        const message = messages._array[index];
        const anchor = manager.getAnchorData(message.id, scrollTop);

        if (anchor && anchor.offsetFromTop + anchor.offsetHeight > 0 && anchor.offsetFromTop < offsetHeight) {
            view ??= { messageId: message.id, offset: anchor.offsetFromTop };
            lastVisibleIndex = index;

            if (anchor.offsetFromTop + anchor.offsetHeight <= offsetHeight) {
                readThrough = message.id;
            }
        }
    }

    if (lastVisibleIndex < 0) {
        return;
    }

    const atLatest = manager.isScrolledToBottom();

    if (atLatest || !messages.hasMoreAfter && messages.length - lastVisibleIndex - 1 <= 5) {
        view = null;
    }

    const previous = historyStorage.get(messages.channelId);
    let progress = previous?.readThroughMessageId;

    if (progressChannels.has(messages.channelId)) {
        progress = newerMessage(progress, atLatest ? messages._array.at(-1)?.id : readThrough);
    }

    const acknowledged = ReadStateStore.getTrackedAckMessageId(messages.channelId);

    if (acknowledged && progress && newerMessage(acknowledged, progress) === acknowledged) {
        progress = undefined;
    }

    if (!view && !progress) {
        historyStorage.delete(messages.channelId);
    } else {
        historyStorage.set(messages.channelId, { view, readThroughMessageId: progress, updatedAt: Date.now() });
    }
}

function isActive(manager?: ScrollManager): boolean {
    if (manager) {
        return scrollManagers.has(manager) && manager.props.messages.betterBackreadingTrimGuard === true;
    }

    return Array.from(scrollManagers).some(manager => isActive(manager));
}

export default definePlugin({
    name: "BetterBackreading",
    description: "Improve backreading with earlier message loading and less rubberbanding.",
    authors: [EquicordDevs.Etorix],
    tags: ["Chat", "Utility"],
    dependencies: ["ChatInputButtonAPI"],
    settings,
    scrollManagers,

    chatBarButton: {
        icon: HistoryIcon,
        render: OpeningPositionButton
    },

    start() {
        this.ensureHistory();
        window.addEventListener("blur", this.pauseHistory);
        window.addEventListener("pagehide", this.pauseHistory);
    },

    stop() {
        this.flushHistory();
        window.removeEventListener("blur", this.pauseHistory);
        window.removeEventListener("pagehide", this.pauseHistory);
    },

    ensureHistory,

    flushHistory,

    pauseHistory,

    deleteChannelHistory,

    deferChannelOpen(options: ChannelOpenOptions, fetch: (options: ChannelOpenOptions) => void) {
        this.ensureHistory();

        if (replayedOpens.delete(options) || !accountId || !options.channelId || options.isPreload || historyStorage.isReady(accountId)) {
            return false;
        }

        const userId = accountId;
        const generation = accountGeneration;
        const { channelId } = options;
        deferredOpens.set(channelId, options);

        void historyLoad.then(() => {
            if (generation !== accountGeneration || currentAccount() !== userId || accountId !== userId || deferredOpens.get(channelId) !== options) {
                return;
            }

            deferredOpens.delete(channelId);
            replayedOpens.add(options);
            fetch(options);
        });

        return true;
    },

    resumeTracking(manager: ScrollManager) {
        const { channelId } = manager.props.messages;
        pausedChannels.delete(channelId);
        progressChannels.add(channelId);
    },

    registerManager(manager: ScrollManager, messages: GuardedMessages) {
        const changedChannel = manager.props.messages.channelId !== messages.channelId;

        if (changedChannel) {
            this.savePosition(manager);
        }

        if (changedChannel || !scrollManagers.has(manager)) {
            pausedChannels.delete(messages.channelId);
        }

        scrollManagers.add(manager);
    },

    syncAcknowledgement,

    flux: {
        CONNECTION_OPEN() {
            ensureHistory();
        },
        CURRENT_USER_UPDATE() {
            ensureHistory();
        },
        LOGOUT() {
            void historyStorage.load(null);
            accountGeneration++;
            accountId = null;
            openingPositions.clear();
            deferredOpens.clear();
            pausedChannels.clear();
            progressChannels.clear();
            scrollManagers.clear();
        },
        CHANNEL_SELECT() {
            flushHistory();
        },
        MESSAGE_ACK({ channelId, messageId, manual }: { channelId: string; messageId: string; manual?: boolean; }) {
            syncAcknowledgement(channelId, messageId, manual);
        },
        CHANNEL_ACK({ channelId, messageId }: { channelId: string; messageId?: string; }) {
            syncAcknowledgement(channelId, messageId ?? ReadStateStore.getTrackedAckMessageId(channelId) ?? undefined);
        },
        LOAD_MESSAGES_FAILURE({ channelId }: { channelId: string; }) {
            openingPositions.delete(channelId);
        },
        CHANNEL_DELETE({ channel }: { channel: { id: string; }; }) {
            deleteChannelHistory(channel.id);
        },
        THREAD_DELETE({ channel }: { channel: { id: string; }; }) {
            deleteChannelHistory(channel.id);
        }
    },

    getOpeningMode(channelId?: string) {
        if (!channelId || ChannelStore.getChannel(channelId)?.isGuildVocal()) {
            return "default";
        }

        const messages = MessageStore?.getMessages(channelId) as GuardedMessages | undefined;

        return messages?.betterBackreadingTrimGuard === true ? settings.store.channelOpenScrollMode : "default";
    },

    getUnreadPosition(channelId: string): OpeningPosition | undefined {
        const local = accountId && historyStorage.isReady(accountId) ? historyStorage.get(channelId)?.readThroughMessageId : undefined;
        const messageId = newerMessage(ReadStateStore.getTrackedAckMessageId(channelId), local);

        if (!messageId) {
            return;
        }

        const latest = ReadStateStore.lastMessageId(channelId);

        if (latest && newerMessage(messageId, latest) === messageId) {
            return;
        }

        if (!local && !ReadStateStore.hasTrackedUnread(channelId)) {
            return;
        }

        const timestamp = SnowflakeUtils.extractTimestamp(messageId);
        const minutes = boundedInteger(settings.store.maximumLastReadAge, 0, 5256000, Number(settings.def.maximumLastReadAge.default));

        if (!Number.isFinite(timestamp) || minutes > 0 && Date.now() - timestamp > minutes * 60000) {
            return;
        }

        return { messageId };
    },

    prepareChannelOpen(options: ChannelOpenOptions) {
        const { channelId, messageId, isPreload } = options;

        if (!channelId || isPreload) {
            return options;
        }

        if (messageId != null) {
            openingPositions.delete(channelId);
            pausedChannels.delete(channelId);
            progressChannels.add(channelId);

            return options;
        }

        const mode = this.getOpeningMode(channelId);
        const restoreSaved = mode === "saved" || mode === "savedLatest";

        if (!restoreSaved && mode !== "unread") {
            openingPositions.delete(channelId);

            return options;
        }

        if (mode === "unread" && openingPositions.get(channelId)?.saved) {
            openingPositions.delete(channelId);
        }

        if (mode === "savedLatest" && !openingPositions.get(channelId)?.saved) {
            openingPositions.delete(channelId);
        }

        const pending = openingPositions.get(channelId);

        if (pending) {
            if (MessageStore.getMessages(channelId).loadingMore) {
                return null;
            }

            // A hidden view may never have completed its previous jump.
            openingPositions.set(channelId, { messageId: pending.messageId, saved: pending.saved });

            return { ...options, messageId: pending.messageId };
        }

        // Refreshes of an already visible chat must not restart its opening jump.
        if (Array.from(scrollManagers).some(manager => manager.props.messages.channelId === channelId && manager.isInitialized() && manager.ref.current?.getScrollerNode()?.getClientRects().length)) {
            return options;
        }

        progressChannels.delete(channelId);
        const saved = restoreSaved && accountId && historyStorage.isReady(accountId) ? historyStorage.get(channelId)?.view : undefined;
        let position: OpeningPosition | undefined;

        if (saved) {
            position = { messageId: saved.messageId, saved };
        } else if (mode !== "savedLatest") {
            position = this.getUnreadPosition(channelId);
        }

        if (!position) {
            return options;
        }

        openingPositions.set(channelId, position);

        return { ...options, messageId: position.messageId };
    },

    getOpeningJumpOptions(channelId: string, messageId: string) {
        const position = openingPositions.get(channelId);

        if (!position || position.messageId !== messageId) {
            return { flash: true };
        }

        position.onJumpComplete ??= () => this.finishOpeningJump(channelId, position);

        return {
            flash: false,
            offset: position.saved ? 0 : 1,
            onJumpComplete: position.onJumpComplete
        };
    },

    cancelOpeningJump(channelId: string, onJumpComplete?: () => void) {
        const position = openingPositions.get(channelId);

        if (position && (!onJumpComplete || position.onJumpComplete !== onJumpComplete)) {
            openingPositions.delete(channelId);
        }

        if (!onJumpComplete || position?.onJumpComplete !== onJumpComplete) {
            pausedChannels.delete(channelId);
            progressChannels.add(channelId);
        }
    },

    finishOpeningJump(channelId: string, position: OpeningPosition) {
        if (openingPositions.get(channelId) !== position) {
            return;
        }

        openingPositions.delete(channelId);
        const managers = Array.from(scrollManagers).filter(manager => this.isActive(manager) && manager.props.messages.channelId === channelId && manager.props.messages.jumpTargetId === position.messageId);
        const mode = this.getOpeningMode(channelId);

        if (!managers.length || mode !== "saved" && mode !== "savedLatest" && mode !== "unread") {
            return;
        }

        // Discord resolves deleted jump targets to a neighboring message. Save that restored view.
        for (const manager of managers) {
            pausedChannels.delete(channelId);
            this.savePosition(manager);
        }
    },

    getOpeningScrollTop(manager: ScrollManager, fallback: number) {
        const position = openingPositions.get(manager.props.messages.channelId);
        const mode = this.getOpeningMode(manager.props.messages.channelId);

        if (!position?.saved || mode !== "saved" && mode !== "savedLatest" || manager.props.messages.jumpTargetId !== position.messageId || !this.isActive(manager)) {
            return fallback;
        }

        const { scrollTop } = manager.getScrollerState();
        const anchor = manager.getAnchorData(position.messageId, scrollTop);

        return anchor ? scrollTop + anchor.offsetFromTop - position.saved.offset : fallback;
    },

    savePosition,

    releaseManager(manager: ScrollManager) {
        this.savePosition(manager);
        scrollManagers.delete(manager);

        if (!Array.from(scrollManagers).some(other => other.props.messages.channelId === manager.props.messages.channelId)) {
            progressChannels.delete(manager.props.messages.channelId);
        }

        this.flushHistory();
    },

    isActive,

    getChannelOpenScrollMode(manager: ScrollManager) {
        return this.isActive(manager) ? settings.store.channelOpenScrollMode : "default";
    },

    getImageScrollMargin() {
        const imageScrollMargin = boundedInteger(settings.store.imageScrollMargin, 300, 3000, 1500);
        const messageLoadBuffer = boundedInteger(settings.store.messageLoadBuffer, 500, 3000, 1500);

        return `${Math.min(imageScrollMargin, messageLoadBuffer)}px`;
    },

    getLoadMoreBuffer(manager?: ScrollManager) {
        return this.isActive(manager) ? boundedInteger(settings.store.messageLoadBuffer, 500, 3000, 1500) : 500;
    },

    getMessageCount(nativeCount: number, channelId: string) {
        if (settings.store.useDiscordMessageCount) {
            return nativeCount;
        }

        // Initial fetches can run before a scroll manager registers for this channel.
        const messages = MessageStore?.getMessages(channelId) as GuardedMessages | undefined;

        return messages?.betterBackreadingTrimGuard === true ? getCustomMessageCount() : nativeCount;
    },

    getWindowThreshold(nativeThreshold: number) {
        if (!this.isActive() || settings.store.useDiscordMessageCount) {
            return nativeThreshold;
        }

        return Math.max(nativeThreshold, 4 * getCustomMessageCount());
    },

    shouldShowJumpToPresent(manager: ScrollManager) {
        if (!settings.store.showJumpToPresentSooner || !this.isActive(manager)) {
            return false;
        }

        const { messages } = manager.props;

        if (messages.hasMoreAfter || !messages.ready) {
            return false;
        }

        const { scrollTop, offsetHeight } = manager.getScrollerState();

        if (offsetHeight <= 0 || !manager.ref.current?.getScrollerNode()?.getClientRects().length) {
            return false;
        }

        for (let index = messages.length - 1; index >= 0; index--) {
            const anchor = manager.getAnchorData(messages._array[index].id, scrollTop);

            if (anchor && anchor.offsetFromTop < offsetHeight && anchor.offsetFromTop + anchor.offsetHeight > 0) {
                return messages.length - index - 1 >= 5;
            }
        }

        return false;
    },

    useJumpToPresent(manager: ScrollManager) {
        const { showJumpToPresentSooner } = settings.use(["showJumpToPresentSooner"]);
        const show = useStateFromStores([DimensionStore], () => this.shouldShowJumpToPresent(manager), [manager, showJumpToPresentSooner]);

        return { show, jump: () => manager.setScrollToBottom() };
    },

    getAutomaticAnchorScrollTop(manager: ScrollManager, anchor: ScrollAnchor, fallback: number) {
        const { scrollTop, scrollHeight, offsetHeight } = manager.getScrollerState();
        const current = manager.getAnchorData(anchor.id, scrollTop);

        if (!current) {
            return fallback;
        }

        // Shorter content can force the scrollbar upward without the user scrolling.
        const maximum = Math.max(0, scrollHeight - offsetHeight);
        const savedScrollTop = Math.min(maximum, Math.max(0, anchor.offsetTop - anchor.offsetFromTop));
        const target = current.offsetTop - anchor.offsetFromTop + scrollTop - savedScrollTop;

        // Record the correction before it can trigger another resize callback.
        anchor.offsetTop = current.offsetTop;
        anchor.offsetFromTop = current.offsetTop - target;

        return target;
    },

    getWindowTarget(nativeTarget: number, messages: GuardedMessages, edge: "Top" | "Bottom") {
        if (!this.isActive() || messages.betterBackreadingTrimGuard !== true) {
            return nativeTarget;
        }

        const minimum = settings.store.useDiscordMessageCount ? nativeTarget : Math.max(nativeTarget, 2 * getCustomMessageCount());
        const target = Math.max(minimum, Math.ceil(messages.length / 2));

        // Keep the whole list when it is already small enough.
        if (target >= messages.length) {
            return target;
        }

        const truncateTop = edge === "Top";
        const cut = truncateTop ? messages.length - target : target - 1;
        const margin = this.getLoadMoreBuffer() + 100;

        // Check each open view of this channel before discarding loaded messages.
        for (const manager of scrollManagers) {
            if (manager.props.messages.channelId !== messages.channelId) {
                continue;
            }

            const node = manager.ref.current?.getScrollerNode();
            const { scrollTop, offsetHeight } = manager.getScrollerState();

            // Skip chat views that are closed, collapsed, or not laid out yet.
            if (!node?.getClientRects().length || offsetHeight <= 0) {
                continue;
            }

            const boundary = manager.getAnchorData(messages._array[cut].id, scrollTop);

            // Keep every message if the cut cannot be measured or would remove visible or preloaded content.
            if (!boundary || (truncateTop ? boundary.offsetFromTop > -margin : boundary.offsetFromTop + boundary.offsetHeight < offsetHeight + margin)) {
                return messages.length;
            }

            // Check whether trimming would remove a message Discord uses to maintain scroll position.
            for (const anchor of [manager.messageFetchAnchor, manager.automaticAnchor]) {
                if (!anchor) {
                    continue;
                }

                const index = messages._array.findIndex(message => message.id === anchor.id);

                // Keep every message if the cut would remove one Discord needs to restore user position.
                if (index >= 0 && (truncateTop ? index < cut : index > cut)) {
                    return messages.length;
                }
            }
        }

        return target;
    },

    patches: [
        {
            find: '"renderStream.jumpToPresent"',
            group: true,
            replacement: [
                {
                    // Reevaluate the button when the viewport dimensions change during scrolling.
                    match: /function \i\(\)\{return (\i)\.isInitialized\(\)\|\|\i\.ready\}/,
                    replace: "$&let betterBackreadingJumpToPresent=$self.useJumpToPresent($1);"
                },
                {
                    match: /\i\.hasMoreAfter(?=&&\i\(\)\)\{let\{jumpReturnTargetId:)/,
                    replace: "($&||betterBackreadingJumpToPresent.show)"
                },
                {
                    // Scroll to already loaded latest messages without replacing the message list.
                    match: /\i\.\i\.jumpToPresent\(\i\.id,\(0,\i\.\i\)\("renderStream\.jumpToPresent"\)\)/,
                    replace: "(betterBackreadingJumpToPresent.show?betterBackreadingJumpToPresent.jump():$&)"
                }
            ]
        },
        {
            find: "updateAutomaticAnchor(",
            group: true,
            replacement: [
                {
                    // Keep the saved anchor offset current while the user scrolls, preventing height correction rubberbanding.
                    match: /(this\.updateAutomaticAnchor\(\i\.scrollTop),!0(?=\):this\.setAutomaticAnchor)/,
                    replace: "$1,!$self.isActive(this)"
                },
                {
                    // Remember where the saved message was before an embed changed height.
                    match: /(\i)\.offsetFromTop=this\.automaticAnchor\.offsetFromTop(?=\))/,
                    replace: "$&,$self.isActive(this)&&($1.offsetTop=this.automaticAnchor.offsetTop)"
                },
                {
                    // Keep ongoing scrolling when correcting for embed height changes.
                    match: /(?<=fixedScrollTop:)\i\.offsetTop-\((\i)\.offsetFromTop\+\i\)/,
                    replace: "$self.isActive(this)&&$1===this.automaticAnchor?$self.getAutomaticAnchorScrollTop(this,$1,$&):$&"
                }
            ]
        },
        {
            // Reduce image pop-in as embeds approach the visible message area.
            find: "_lazyLoadTargets",
            replacement: {
                match: /(?<=rootMargin:"300px")/,
                replace: ",scrollMargin:$self.getImageScrollMargin()"
            }
        },
        {
            find: "getOffsetToTriggerLoading(",
            group: true,
            replacement: [
                {
                    // Request messages earlier as scrolling approaches a loading boundary.
                    match: /500(?=;return \i\.hasMoreAfter)|(?<=\i\.hasMoreAfter\?\i-\i-\i-)500/g,
                    replace: "$self.getLoadMoreBuffer(this)"
                },
                {
                    // Include unread history without changing where Discord restores the unread view.
                    match: /(\i<=this\.getOffsetToTriggerLoading\("top",\i\))(?=&&\i>\i\?1:)/,
                    replace: "$1+(this.props.hasUnreads&&$self.isActive(this)?$self.getLoadMoreBuffer(this):0)"
                }
            ]
        },
        {
            // Apply the selected opening position while preserving explicit message jumps.
            find: "restoreScroll(){",
            group: true,
            replacement: [
                {
                    match: /(let\{initialScrollTop:(\i)\}=this;)/,
                    replace: "$1if($self.getChannelOpenScrollMode(this)!==\"default\")$2=null;"
                },
                {
                    match: /this\.props\.hasUnreads(?=&&this\.props\.channel\.type)/,
                    replace: "$self.getChannelOpenScrollMode(this)===\"default\"&&$&"
                },
                {
                    // Restore the saved message's viewport offset during the native jump.
                    match: /this\.getOffsetOrientationFromNode\(\i,"middle",(?:this\.props\.hasUnreads|\i)\?this\.newMessageBarBuffer\(\):16\)/g,
                    replace: "$self.getOpeningScrollTop(this,$&)"
                },
                {
                    match: /updateStoreDimensions\(\i\)\{/,
                    replace: "$&$self.savePosition(this);"
                },
                {
                    match: /handleUserScrollGesture=\(\)=>\{/,
                    replace: "$&$self.resumeTracking(this);"
                },
                {
                    match: /handleMouseDown=\i=>\{/,
                    replace: "$&$self.resumeTracking(this);"
                }
            ]
        },
        {
            // Prevent scroll jumps at either placeholder boundary while messages load.
            find: "handleScrollSpeed(",
            replacement: {
                match: /([12]===\i&&)(?=\i\+\i[<>]=)/g,
                replace: "$1(!$self.isActive(this)||!this.isLoading())&&"
            }
        },
        {
            // Prevent held Escape from repeatedly requesting the latest messages.
            find: '"esc","shift+pagedown"',
            replacement: {
                match: /action\((\i)\)\{/,
                replace: "$&if($1?.repeat&&$1.key===\"Escape\"&&$self.isActive())return!1;"
            }
        },
        {
            find: "mergePropsAndUpdate_(",
            group: true,
            replacement: [
                {
                    // Notice when loading a new batch also discards messages from the other end.
                    match: /(mergePropsAndUpdate_\((\i)\)\{let (\i)=this\.props\.messages)/,
                    replace: "$1,betterBackreadingSmoothScrollWindowShifted=$self.isActive(this)&&$3.length>0&&$2.messages.length>0&&$3.first()?.id!==$2.messages.first()?.id&&$3.last()?.id!==$2.messages.last()?.id"
                },
                {
                    // Allow fast middle-click scrolling through messages without getting stuck in a placeholder boundary.
                    match: /(this\.loadMorePausedUntilUserScroll\|\|\i<100)/,
                    replace: "$1&&!betterBackreadingSmoothScrollWindowShifted"
                },
                {
                    // Restore the reading position even when added and discarded messages have equal height.
                    match: /(?<=this\.isHeightChange\(\i,\i\))(?=;if\(this\.offsetHeightCache=)/,
                    replace: "||betterBackreadingSmoothScrollWindowShifted"
                }
            ]
        },
        {
            // Choose how many messages are fetched with each history request.
            find: '"scrollManager.loadMore"',
            replacement: {
                match: /(?<=channelId:(\i)\.props\.channel\.id,before:\i,after:\i,limit:)Math\.min\((?:\i\.\i|30),2\*\(0,\i\.\i\)\("scrollManager\.loadMore"\)\)/,
                replace: "$self.getMessageCount($&,$1.props.channel.id)"
            }
        },
        {
            // Use the custom batch size for channel opening, thread opening, and stale history refreshes.
            find: '"MessageManager.initialFetch"',
            group: true,
            replacement: [
                {
                    match: /(?<=channelId:(\i),limit:)(?:\(0,\i\.\i\)\("MessageManager\.(?:threadStart|threadUnread|staleFetch)"\)|\i)(?=,)/g,
                    replace: "$self.getMessageCount($&,$1)"
                },
                {
                    // Select an opening message before Discord chooses its cached or network fetch path.
                    match: /function (\i)\((\i)\)\{(?=let\{guildId:\i,channelId:\i,messageId:\i,forceFetch:)/,
                    replace: "$&if($self.deferChannelOpen($2,$1)||!($2=$self.prepareChannelOpen($2)))return;"
                },
                {
                    match: /(?<=jumpToMessage\(\{channelId:(\i),messageId:(\i),)flash:!0/,
                    replace: "...$self.getOpeningJumpOptions($1,$2)"
                },
                {
                    // Custom opening modes use the selected target or the latest history.
                    match: /(else if\()(\i)\?\.isThread\(\)&&/g,
                    replace: "$1$self.getOpeningMode($2?.id)===\"default\"&&$2?.isThread()&&"
                }
            ]
        },
        {
            find: "MessageActionCreators",
            group: true,
            replacement: [
                {
                    // Explicit message jumps cancel any unfinished opening restoration.
                    match: /jumpToMessage\((\i)\)\{/,
                    replace: "$&$self.cancelOpeningJump($1.channelId,$1.onJumpComplete);"
                },
                {
                    // Use the custom batch size when jumping to a linked message.
                    match: /(?<=channelId:(\i),limit:)(?:\i\.\i|30)(?=,jump:\{messageId:)/,
                    replace: "$self.getMessageCount($&,$1)"
                },
                {
                    // Use the custom batch size when jumping to the latest messages.
                    match: /jumpToPresent\((\i),(\i)\)\{/,
                    replace: "$&$self.cancelOpeningJump($1);$2=$self.getMessageCount($2,$1);"
                }
            ]
        },
        {
            // Request archived forum posts in the sort order selected instead of always by most recently active.
            find: 'sort_by:"last_message_time"',
            replacement: {
                match: /(sortOrder:(\i).{0,100}sort_by:)"last_message_time"/,
                replace: '$1$2===1?"creation_time":"last_message_time"'
            }
        },
        {
            // Keep visible messages and the preload area when Discord trims its message list.
            // Also, register a flag indicating this group applied successfully. Without this group,
            // the earlier message preloading in conjunction with post-request truncation can result
            // in visible messages being discarded and more being requested in a loop.
            find: "truncateBottom(",
            group: true,
            replacement: [
                {
                    match: /(?<=this\.length<=)(?:\i\.\i|120)(?=\?)/,
                    replace: "$self.getWindowThreshold($&)"
                },
                {
                    match: /(?<=this\.length>)(?:\i\.\i|120)(?=\?)/,
                    replace: "$self.getWindowThreshold($&)"
                },
                {
                    match: /truncateTop\((\i)\)\{/,
                    replace: "get betterBackreadingTrimGuard(){return true;}$&$1=$self.getWindowTarget($1,this,\"Top\");"
                },
                {
                    match: /truncateBottom\((\i)\)\{/,
                    replace: "$&$1=$self.getWindowTarget($1,this,\"Bottom\");"
                }
            ]
        },
        {
            // Read each open chat's current viewport when deciding which messages can be discarded.
            // Keep tracking a chat view when Discord hides it and shows it again.
            find: "getOffsetToTriggerLoading(",
            group: true,
            replacement: [
                {
                    match: /mergePropsAndUpdate\((\i)\)\{/,
                    replace: "$&$self.registerManager(this,$1.messages);"
                },
                {
                    match: /cleanup\(\)\{(?=this\.acking=)/,
                    replace: "$&$self.releaseManager(this);"
                }
            ]
        }
    ]
});
