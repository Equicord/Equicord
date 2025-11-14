/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { Channel, Message, MessageAttachment } from "@vencord/discord-types";
import { ChannelType, MessageFlags } from "@vencord/discord-types/enums";
import { findComponentByCodeLazy } from "@webpack";
import { ChannelStore, NavigationRouter, React, RestAPI, SelectedChannelStore, Toasts, useStateFromStores } from "@webpack/common";

const HeaderBarIcon = findComponentByCodeLazy(".HEADER_BAR_BADGE_TOP:", '.iconBadge,"top"');
const logger = new Logger("MessageShuffler", "#f2cdcd");

const RANDOM_ATTEMPTS = 12;
const FETCH_LIMIT = 50;
const RANGE_SCALE = 1000n;
const DEPTH_MARKERS = [10, 80, 200, 400, 650, 900];

const SUPPORTED_CHANNEL_TYPES = new Set([
    ChannelType.GUILD_TEXT,
    ChannelType.DM,
    ChannelType.GROUP_DM,
    ChannelType.GUILD_ANNOUNCEMENT,
    ChannelType.ANNOUNCEMENT_THREAD,
    ChannelType.PUBLIC_THREAD,
    ChannelType.PRIVATE_THREAD,
    ChannelType.GUILD_FORUM,
    ChannelType.GUILD_MEDIA
]);

const settings = definePluginSettings({
    includeMessages: {
        description: "Allow plain text messages",
        type: OptionType.BOOLEAN,
        default: true
    },
    includeLinks: {
        description: "Allow messages that contain a URL",
        type: OptionType.BOOLEAN,
        default: true
    },
    includeEmbeds: {
        description: "Allow messages with embeds (link previews, videos, etc.)",
        type: OptionType.BOOLEAN,
        default: true
    },
    includePolls: {
        description: "Allow poll messages",
        type: OptionType.BOOLEAN,
        default: true
    },
    includeForwards: {
        description: "Allow forwarded messages",
        type: OptionType.BOOLEAN,
        default: true
    },
    includeStickers: {
        description: "Allow stickers",
        type: OptionType.BOOLEAN,
        default: true
    },
    includeImages: {
        description: "Allow image attachments",
        type: OptionType.BOOLEAN,
        default: true
    },
    includeVideos: {
        description: "Allow video attachments",
        type: OptionType.BOOLEAN,
        default: true
    },
    includeSounds: {
        description: "Allow audio attachments / voice messages",
        type: OptionType.BOOLEAN,
        default: true
    },
    includeFiles: {
        description: "Allow other file attachments",
        type: OptionType.BOOLEAN,
        default: true
    }
});

const FILTER_KEYS = [
    "includeMessages",
    "includeLinks",
    "includeEmbeds",
    "includePolls",
    "includeForwards",
    "includeStickers",
    "includeImages",
    "includeVideos",
    "includeSounds",
    "includeFiles"
] as const;

type FilterKey = typeof FILTER_KEYS[number];

const LINK_REGEX = /https?:\/\/\S+/i;
const EXTENSION_REGEX = /\.([a-z0-9]+)(?:\?.*)?$/i;

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "tiff", "tif", "heic", "heif", "avif"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "m4v", "webm", "mkv", "avi", "wmv", "mpe", "mpeg", "mpg", "flv"]);
const AUDIO_EXTENSIONS = new Set(["mp3", "m4a", "aac", "wav", "ogg", "oga", "opus", "flac", "aiff", "caf"]);

const authors = [
    {
        name: "coahh.",
        id: 761701756119547955n
    }
];

type ChannelBounds = {
    oldest?: string;
    newest?: string;
    pendingOldest?: Promise<string>;
};

const channelBounds = new Map<string, ChannelBounds>();

function ensureBoundsEntry(channelId: string) {
    let entry = channelBounds.get(channelId);
    if (!entry) {
        entry = {};
        channelBounds.set(channelId, entry);
    }

    return entry;
}

function getCrypto() {
    const { crypto } = globalThis as typeof globalThis & { crypto?: Crypto; };
    return crypto;
}

function fillBytesWithMathRandom(bytes: Uint8Array) {
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = Math.floor(Math.random() * 256);
    }
}

function randomSnowflake(min: bigint, max: bigint) {
    if (min >= max) return min;

    const range = max - min;
    const bitsNeeded = range.toString(2).length;
    const bytesNeeded = Math.ceil(bitsNeeded / 8);
    const buffer = new Uint8Array(bytesNeeded);

    while (true) {
        const crypto = getCrypto();
        if (crypto && crypto.getRandomValues) crypto.getRandomValues(buffer);
        else fillBytesWithMathRandom(buffer);

        let candidate = 0n;
        for (const byte of buffer) {
            candidate = (candidate << 8n) + BigInt(byte);
        }

        if (candidate <= range) return min + candidate;
    }
}

async function requestMessages(channelId: string, query: string): Promise<Message[]> {
    const response = await RestAPI.get({ url: `/channels/${channelId}/messages${query}` });
    return response?.body ?? [];
}

async function fetchOldestMessageId(channelId: string): Promise<string> {
    const entry = ensureBoundsEntry(channelId);
    if (entry.oldest) return entry.oldest;

    if (!entry.pendingOldest) {
        entry.pendingOldest = requestMessages(channelId, "?after=0&limit=1").finally(() => {
            entry.pendingOldest = undefined;
        }).then(messages => {
            const first = messages[0];
            if (!first) throw new Error("Channel does not have any messages yet.");
            entry.oldest = first.id;
            return first.id;
        });
    }

    return entry.pendingOldest;
}

async function fetchNewestMessageId(channel: Channel): Promise<string> {
    const entry = ensureBoundsEntry(channel.id);

    if (channel.lastMessageId) {
        entry.newest = channel.lastMessageId;
        return channel.lastMessageId;
    }

    if (entry.newest) return entry.newest;

    const messages = await requestMessages(channel.id, "?limit=1");
    const newest = messages[0]?.id;
    if (!newest) throw new Error("Channel does not have any messages yet.");
    entry.newest = newest;
    return newest;
}

async function fetchAround(channelId: string, pivot: string): Promise<Message[]> {
    return requestMessages(channelId, `?limit=${FETCH_LIMIT}&around=${pivot}`);
}

async function fetchLatestMessage(channelId: string): Promise<Message | undefined> {
    const messages = await requestMessages(channelId, "?limit=1");
    return messages[0];
}

async function fetchEarliestBatch(channelId: string): Promise<Message[]> {
    return requestMessages(channelId, `?after=0&limit=${FETCH_LIMIT}`);
}

type AttachmentCategory = "image" | "video" | "sound" | "file";

function classifyAttachment(attachment: MessageAttachment): AttachmentCategory {
    const contentType = attachment.content_type?.toLowerCase();
    if (contentType) {
        if (contentType.startsWith("image/")) return "image";
        if (contentType.startsWith("video/")) return "video";
        if (contentType.startsWith("audio/")) return "sound";
    }

    const filename = attachment.filename?.toLowerCase();
    if (filename) {
        const ext = filename.match(EXTENSION_REGEX)?.[1];
        if (ext) {
            if (IMAGE_EXTENSIONS.has(ext)) return "image";
            if (VIDEO_EXTENSIONS.has(ext)) return "video";
            if (AUDIO_EXTENSIONS.has(ext)) return "sound";
        }
    }

    return "file";
}

function buildAttachmentPresence(message: Message) {
    const presence = { image: false, video: false, sound: false, file: false } as Record<AttachmentCategory, boolean>;
    if (!Array.isArray(message.attachments)) return presence;

    for (const attachment of message.attachments) {
        const category = classifyAttachment(attachment);
        presence[category] = true;
    }

    return presence;
}

function hasActiveFilters() {
    return FILTER_KEYS.some(key => settings.store[key]);
}

function getStickerItems(message: Message) {
    const { stickerItems, sticker_items } = message as any;
    const stickers = stickerItems ?? sticker_items;
    return Array.isArray(stickers) ? stickers : [];
}

function getMessageSnapshots(message: Message) {
    const { messageSnapshots, message_snapshots } = message as any;
    const snapshots = messageSnapshots ?? message_snapshots;
    return Array.isArray(snapshots) ? snapshots : [];
}

function hasLinks(message: Message) {
    const content = message.content ?? "";
    if (LINK_REGEX.test(content)) return true;
    const { codedLinks } = message as any;
    return Array.isArray(codedLinks) && codedLinks.length > 0;
}

function messageMatchesFilters(message: Message) {
    const { store } = settings;
    if (!hasActiveFilters()) return true;

    const attachments = buildAttachmentPresence(message);
    const trimmedContent = message.content?.trim() ?? "";
    const hasText = trimmedContent.length > 0;
    const hasLink = hasLinks(message);
    const hasEmbed = Array.isArray(message.embeds) && message.embeds.length > 0;
    const hasPoll = Boolean((message as any).poll);
    const stickerCount = getStickerItems(message).length;
    const hasSticker = stickerCount > 0;
    const hasForward = Boolean((typeof message.flags === "number" && (message.flags & MessageFlags.HAS_SNAPSHOT) !== 0) || getMessageSnapshots(message).length);
    const isVoiceMessage = typeof message.flags === "number" && (message.flags & MessageFlags.IS_VOICE_MESSAGE) !== 0;

    if (store.includeMessages && hasText) return true;
    if (store.includeLinks && hasLink) return true;
    if (store.includeEmbeds && hasEmbed) return true;
    if (store.includePolls && hasPoll) return true;
    if (store.includeForwards && hasForward) return true;
    if (store.includeStickers && hasSticker) return true;
    if (store.includeImages && attachments.image) return true;
    if (store.includeVideos && attachments.video) return true;
    if (store.includeSounds && (attachments.sound || isVoiceMessage)) return true;
    if (store.includeFiles && attachments.file) return true;

    return false;
}

function pickRandomMatching(messages: Message[]): Message | null {
    const filtered = messages.filter(messageMatchesFilters);
    if (!filtered.length) return null;
    return filtered[Math.floor(Math.random() * filtered.length)];
}

function pivotFromMarker(min: bigint, max: bigint, marker: number) {
    if (min >= max) return min.toString();
    const range = max - min;
    const scaled = range * BigInt(marker) / RANGE_SCALE;
    return (min + scaled).toString();
}

async function findShuffledMessage(channel: Channel): Promise<Message> {
    const oldestId = await fetchOldestMessageId(channel.id);
    const newestId = await fetchNewestMessageId(channel);

    const min = BigInt(oldestId);
    const max = BigInt(newestId);

    if (min === max) {
        const sole = await fetchLatestMessage(channel.id);
        if (!sole) throw new Error("Could not locate the only message in this channel.");
        return sole;
    }

    for (let attempt = 0; attempt < RANDOM_ATTEMPTS; attempt++) {
        const pivot = randomSnowflake(min, max).toString();
        const batch = await fetchAround(channel.id, pivot);
        const candidate = pickRandomMatching(batch);
        if (candidate) return candidate;
    }

    for (const marker of DEPTH_MARKERS) {
        const pivot = pivotFromMarker(min, max, marker);
        const batch = await fetchAround(channel.id, pivot);
        const candidate = pickRandomMatching(batch);
        if (candidate) return candidate;
    }

    const oldestBatch = await fetchEarliestBatch(channel.id);
    const oldestCandidate = pickRandomMatching(oldestBatch);
    if (oldestCandidate) return oldestCandidate;

    // fallback to newest message honoring filters
    const newestBatch = await fetchAround(channel.id, max.toString());
    const newestCandidate = pickRandomMatching(newestBatch);
    if (newestCandidate) return newestCandidate;

    const fallback = await fetchLatestMessage(channel.id);
    if (!fallback || !messageMatchesFilters(fallback)) {
        throw new Error("Could not find any messages matching the current filters.");
    }
    return fallback;
}

function useCurrentChannel(): Channel | null {
    return useStateFromStores([SelectedChannelStore, ChannelStore], () => {
        const id = SelectedChannelStore.getChannelId();
        return id ? ChannelStore.getChannel(id) ?? null : null;
    });
}

function describeChannel(channel: Channel | null) {
    if (!channel) return "this channel";
    if (channel.rawRecipients?.length) {
        const names = channel.rawRecipients.slice(0, 3).map(user => user.username).join(", ");
        return names || "this DM";
    }
    return channel.name ? `#${channel.name}` : "this channel";
}

function getAuthorDisplayName(message?: Message) {
    const author: any = message?.author;
    return author?.globalName ?? author?.global_name ?? author?.username ?? "someone";
}

function buildSuccessToast(channel: Channel, message: Message) {
    return `Jumping to a message from ${getAuthorDisplayName(message)} in ${describeChannel(channel)}`;
}

function ShuffleIcon({ active }: { active?: boolean; }) {
    return (
        <svg
            className={`message-shuffler-icon${active ? " message-shuffler-icon--active" : ""}`}
            viewBox="0 0 24 24"
            width={20}
            height={20}
            xmlns="http://www.w3.org/2000/svg"
        >
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M17.2929 3.29289C17.6834 2.90237 18.3166 2.90237 18.7071 3.29289L21.7071 6.29289C22.0976 6.68342 22.0976 7.31658 21.7071 7.70711L18.7071 10.7071C18.3166 11.0976 17.6834 11.0976 17.2929 10.7071C16.9024 10.3166 16.9024 9.68342 17.2929 9.29289L18.4858 8.1H17.1339C15.6006 8.1 14.2417 8.85096 13.0268 9.94141C12.6158 10.3103 11.9835 10.2762 11.6146 9.86514C11.2457 9.45413 11.2799 8.82188 11.6909 8.45299C13.0917 7.19573 14.9088 6.1 17.1339 6.1H18.6858L17.2929 4.70711C16.9024 4.31658 16.9024 3.68342 17.2929 3.29289ZM2 7.1C2 6.54772 2.44772 6.1 3 6.1C6.82463 6.1 9.24061 9.04557 11.1944 11.473C11.2677 11.5642 11.3405 11.6548 11.4128 11.7447C12.3547 12.917 13.2086 13.9797 14.1313 14.7835C15.1035 15.6305 16.0541 16.1 17.1291 16.1H18.6858L17.2929 14.7071C16.9024 14.3166 16.9024 13.6834 17.2929 13.2929C17.6834 12.9024 18.3166 12.9024 18.7071 13.2929L21.7071 16.2929C22.0976 16.6834 22.0976 17.3166 21.7071 17.7071L18.7071 20.7071C18.3166 21.0976 17.6834 21.0976 17.2929 20.7071C16.9024 20.3166 16.9024 19.6834 17.2929 19.2929L18.4858 18.1H17.1291C15.3977 18.1 13.9975 17.3195 12.8175 16.2915C11.8362 15.4366 10.94 14.3486 10.0918 13.2941C9.25289 14.3419 8.35876 15.4156 7.37784 16.2661C6.17696 17.3072 4.75087 18.1 3.00536 18.1C2.45308 18.1 2.00536 17.6523 2.00536 17.1C2.00536 16.5477 2.45308 16.1 3.00536 16.1C4.094 16.1 5.07128 15.6188 6.06772 14.7549C7.00179 13.9451 7.86818 12.8757 8.79915 11.7073C7.04692 9.6323 5.35215 8.1 3 8.1C2.44772 8.1 2 7.65229 2 7.1Z"
                fill="currentColor"
            />
        </svg>
    );
}

function isSupportedChannel(channel: Channel | null): channel is Channel {
    return Boolean(channel && SUPPORTED_CHANNEL_TYPES.has(channel.type));
}

function MessageShufflerButton() {
    const channel = useCurrentChannel();
    const [isFetching, setIsFetching] = React.useState(false);

    const tooltip = React.useMemo(() => {
        if (!channel) return "Open a text channel to unlock random jumps";
        if (!isSupportedChannel(channel)) return "Random jumps are only available in text-based channels";
        return isFetching ? "Finding a message…" : "Jump to a random message";
    }, [channel, isFetching]);

    const handleClick = React.useCallback(async () => {
        if (!channel || !isSupportedChannel(channel) || isFetching) return;

        if (!hasActiveFilters()) {
            Toasts.show({
                message: "Enable at least one MessageShuffler filter first.",
                type: Toasts.Type.FAILURE,
                id: Toasts.genId(),
                options: { position: Toasts.Position.BOTTOM }
            });
            return;
        }

        setIsFetching(true);
        try {
            const message = await findShuffledMessage(channel);
            const guildSegment = channel.guild_id ?? "@me";
            NavigationRouter.transitionTo(`/channels/${guildSegment}/${channel.id}/${message.id}`);
            Toasts.show({
                message: buildSuccessToast(channel, message),
                type: Toasts.Type.SUCCESS,
                id: Toasts.genId(),
                options: { position: Toasts.Position.BOTTOM }
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Failed to find a random message.";
            Toasts.show({
                message: errorMessage,
                type: Toasts.Type.FAILURE,
                id: Toasts.genId(),
                options: { position: Toasts.Position.BOTTOM }
            });
            logger.error("Failed to find random message", error);
        } finally {
            setIsFetching(false);
        }
    }, [channel, isFetching]);

    return (
        <HeaderBarIcon
            tooltip={tooltip}
            icon={() => <ShuffleIcon active={isFetching} />}
            onClick={handleClick}
            selected={isFetching}
        />
    );
}

export default definePlugin({
    name: "MessageShuffler",
    description: "Adds a toolbar button that shuffles you to a random message in the current channel",
    authors,
    settings,
    patches: [
        {
            find: ".controlButtonWrapper,",
            replacement: {
                match: /(function \i\(\i\){)(.{1,200}toolbar.{1,450}mobileToolbar)/,
                replace: "$1$self.addIconToToolBar(arguments[0]);$2"
            }
        }
    ],
    addIconToToolBar(props: { toolbar: React.ReactNode | React.ReactNode[]; }) {
        const button = (
            <ErrorBoundary noop={true}>
                <MessageShufflerButton />
            </ErrorBoundary>
        );

        if (Array.isArray(props.toolbar)) props.toolbar.unshift(button);
        else props.toolbar = [button, props.toolbar];
    },
    stop() {
        channelBounds.clear();
    }
});
