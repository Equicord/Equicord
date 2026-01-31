/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { DecoratorProps } from "@api/MemberListDecorators";
import { Devs, EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import definePlugin from "@utils/types";
import { Channel, Message } from "@vencord/discord-types";
import { MessageFlags } from "@vencord/discord-types/enums";
import { findByPropsLazy, findCssClassesLazy, findExportedComponentLazy } from "@webpack";
import { ChannelStore, MessageStore, SnowflakeUtils, UserStore,useStateFromStores } from "@webpack/common";

const cl = classNameFactory("vc-message-peek-");

const PrivateChannelClasses = findCssClassesLazy("subtext", "channel", "interactive");
const ActivityClasses = findCssClassesLazy("textWithIconContainer", "icon", "truncated", "container", "textXs");
const MessageActions = findByPropsLazy("fetchMessages", "sendMessage");

const Icons = {
    image: findExportedComponentLazy("ImageIcon"),
    file: findExportedComponentLazy("AttachmentIcon"),
    voice: findExportedComponentLazy("MicrophoneIcon"),
    sticker: findExportedComponentLazy("StickerIcon"),
    gif: findExportedComponentLazy("GifIcon"),
    video: findExportedComponentLazy("VideoIcon"),
};

function getAttachmentType(contentType = ""): "image" | "gif" | "video" | "file" {
    if (contentType === "image/gif") return "gif";
    if (contentType.startsWith("image/")) return "image";
    if (contentType.startsWith("video/")) return "video";
    return "file";
}

function formatRelativeTime(timestamp: number): string {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days >= 365) return `${Math.floor(days / 365)}y`;
    if (days >= 30) return `${Math.floor(days / 30)}mo`;
    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    return `${Math.max(1, minutes)}m`;
}

function pluralize(count: number, singular: string, plural = singular + "s") {
    return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

function getMessageContent(message: Message): { text: string; icon?: keyof typeof Icons; } | null {
    if (message.content) {
        if (/https?:\/\/(\S+\.gif|tenor\.com|giphy\.com)/i.test(message.content)) {
            return { text: "sent a GIF", icon: "gif" };
        }
        return { text: message.content };
    }

    if (message.flags & MessageFlags.IS_VOICE_MESSAGE) {
        return { text: "voice message", icon: "voice" };
    }

    if (message.attachments?.length) {
        const types = message.attachments.map(a => getAttachmentType(a.content_type));
        const allSame = types.every(t => t === types[0]);
        const count = types.length;

        if (allSame) {
            const type = types[0];
            const labels = { gif: "GIF", image: "image", video: "video", file: "file" };
            return { text: pluralize(count, labels[type]), icon: type };
        }
        return { text: pluralize(count, "file"), icon: "file" };
    }

    if (message.stickerItems?.length) {
        return { text: message.stickerItems[0].name, icon: "sticker" };
    }

    return null;
}

function MessagePreview({ channel }: { channel: Channel; }) {
    const lastMessage = useStateFromStores([MessageStore], () => MessageStore.getLastMessage(channel.id) as Message | undefined);

    if (channel.isSystemDM()) {
        return <div className={PrivateChannelClasses.subtext}>Official Discord Message</div>;
    }

    if (channel.isMultiUserDM()) {
        return <div className={PrivateChannelClasses.subtext}>{channel.recipients.length + 1} Members</div>;
    }

    if (!lastMessage) return null;

    const content = getMessageContent(lastMessage);
    if (!content) return null;

    const currentUser = UserStore.getCurrentUser();
    const isOwnMessage = lastMessage.author.id === currentUser.id;
    const authorName = isOwnMessage ? "You" : (lastMessage.author.globalName ?? lastMessage.author.username);
    const Icon = content.icon ? Icons[content.icon] : null;

    return (
        <div className={PrivateChannelClasses.subtext}>
            <div className={`${ActivityClasses.container} ${ActivityClasses.textXs} ${cl("preview")}`}>
                <span className={ActivityClasses.truncated}>{authorName}: {content.text}</span>
                {Icon && <span className={cl("icon")}><Icon size="xxs" className={ActivityClasses.icon} /></span>}
            </div>
        </div>
    );
}

function Timestamp({ channel }: { channel: Channel; }) {
    const lastMessage = useStateFromStores([MessageStore], () => MessageStore.getLastMessage(channel.id) as Message | undefined);

    if (!lastMessage) return null;

    const timestamp = SnowflakeUtils.extractTimestamp(lastMessage.id);
    return <span className={cl("timestamp")}>{formatRelativeTime(timestamp)}</span>;
}

export default definePlugin({
    name: "MessagePeek",
    description: "Shows the last message preview and timestamp in the Direct Messages list.",
    authors: [Devs.prism, EquicordDevs.justjxke],
    patches: [
        {
            find: "PrivateChannel.renderAvatar",
            replacement: {
                match: /,subText:(\i)\.isSystemDM\(\).{0,500}:null,(?=name:)/,
                replace: ",subText:$self.getMessagePreview($1),"
            }
        }
    ],

    async start() {
        const channels = ChannelStore.getSortedPrivateChannels();
        for (const channel of channels) {
            if (!MessageStore.getLastMessage(channel.id)) {
                await MessageActions.fetchMessages({ channelId: channel.id, limit: 1 });
            }
        }
    },

    renderMemberListDecorator({ channel }: DecoratorProps) {
        if (!channel) return null;
        return <Timestamp channel={channel} />;
    },

    getMessagePreview(channel: Channel) {
        return <MessagePreview channel={channel} />;
    }
});
