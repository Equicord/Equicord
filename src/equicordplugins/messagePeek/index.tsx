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
import { findCssClassesLazy, findExportedComponentLazy } from "@webpack";
import { MessageStore, SnowflakeUtils, UserStore } from "@webpack/common";

const cl = classNameFactory("vc-message-peek-");

const PrivateChannelClasses = findCssClassesLazy("subtext", "channel", "interactive");
const ActivityClasses = findCssClassesLazy("textWithIconContainer", "icon", "truncated", "container", "textXs");

const ImageIcon = findExportedComponentLazy("ImageIcon");
const AttachmentIcon = findExportedComponentLazy("AttachmentIcon");
const WaveformIcon = findExportedComponentLazy("WaveformIcon");
const StickerIcon = findExportedComponentLazy("StickerIcon");
const GifIcon = findExportedComponentLazy("GifIcon");
const VideoIcon = findExportedComponentLazy("VideoIcon");

type IconComponent = React.ComponentType<{ size: string; className?: string; }>;

interface Attachment {
    content_type?: string;
}

function getAttachmentType(attachment: Attachment): "image" | "gif" | "video" | "file" {
    const contentType = attachment.content_type ?? "";
    if (contentType === "image/gif") return "gif";
    if (contentType.startsWith("image/")) return "image";
    if (contentType.startsWith("video/")) return "video";
    return "file";
}

function getAttachmentInfo(attachments: Attachment[]): { type: "image" | "gif" | "video" | "file"; count: number; } {
    let gif = 0, image = 0, video = 0;

    for (const attachment of attachments) {
        const type = getAttachmentType(attachment);
        if (type === "gif") gif++;
        else if (type === "image") image++;
        else if (type === "video") video++;
    }

    const total = attachments.length;
    if (gif === total) return { type: "gif", count: gif };
    if (image === total) return { type: "image", count: image };
    if (video === total) return { type: "video", count: video };

    return { type: "file", count: total };
}

function formatRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;

    const minutes = Math.max(1, Math.floor(diff / 60000));
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (years > 0) return `${years}y`;
    if (months > 0) return `${months}mo`;
    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    return `${minutes}m`;
}

const attachmentIcons: Record<string, IconComponent> = {
    image: ImageIcon,
    gif: GifIcon,
    video: VideoIcon,
    file: AttachmentIcon
};

const attachmentLabels: Record<string, string> = {
    image: "image",
    gif: "GIF",
    video: "video",
    file: "file"
};

const containerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 4
};

const iconWrapperStyle: React.CSSProperties = {
    display: "flex",
    marginTop: 0.8
};

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

    renderMemberListDecorator({ channel }: DecoratorProps) {
        if (!channel) return null;

        const lastMessage: Message | undefined = MessageStore.getLastMessage(channel.id);
        if (!lastMessage) return null;

        const timestamp = SnowflakeUtils.extractTimestamp(lastMessage.id);
        const relativeTime = formatRelativeTime(timestamp);

        return (
            <span className={cl("timestamp")}>{relativeTime}</span>
        );
    },

    getMessagePreview(channel: Channel) {
        if (channel.isSystemDM()) {
            return (
                <div className={PrivateChannelClasses.subtext}>
                    Official Discord Message
                </div>
            );
        }

        if (channel.isMultiUserDM()) {
            return (
                <div className={PrivateChannelClasses.subtext}>
                    {channel.recipients.length + 1} Members
                </div>
            );
        }

        const lastMessage: Message | undefined = MessageStore.getLastMessage(channel.id);
        if (!lastMessage) return null;

        const currentUser = UserStore.getCurrentUser();
        const isOwnMessage = lastMessage.author.id === currentUser.id;
        const authorName = isOwnMessage ? "You" : (lastMessage.author.globalName ?? lastMessage.author.username);

        let content: string;
        let Icon: IconComponent | null = null;

        if (lastMessage.content) {
            if (/https?:\/\/(\S+\.gif|tenor\.com|giphy\.com)/i.test(lastMessage.content)) {
                content = "sent a GIF";
                Icon = GifIcon;
            } else {
                content = lastMessage.content;
            }
        } else if (lastMessage.flags & MessageFlags.IS_VOICE_MESSAGE) {
            content = "voice message";
            Icon = WaveformIcon;
        } else if (lastMessage.attachments?.length) {
            const { type, count } = getAttachmentInfo(lastMessage.attachments);
            Icon = attachmentIcons[type];
            const label = attachmentLabels[type];
            content = type === "gif"
                ? (count > 1 ? `${count} GIFs` : "GIF")
                : `${count} ${label}${count > 1 ? "s" : ""}`;
        } else if (lastMessage.stickerItems?.length) {
            const sticker = lastMessage.stickerItems[0];
            content = sticker.name;
            Icon = StickerIcon;
        } else {
            return null;
        }

        return (
            <div className={PrivateChannelClasses.subtext}>
                <div className={`${ActivityClasses.container} ${ActivityClasses.textXs}`} style={containerStyle}>
                    <span className={ActivityClasses.truncated}>{authorName}: {content}</span>
                    {Icon && <span style={iconWrapperStyle}><Icon size="xxs" className={ActivityClasses.icon} /></span>}
                </div>
            </div>
        );
    }
});
