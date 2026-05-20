/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { classNameFactory } from "@utils/css";
import { Channel, RenderModalProps } from "@vencord/discord-types";
import { findByPropsLazy, findComponentByCodeLazy } from "@webpack";
import { Avatar, Button, ChannelStore, MessageStore, Modal,React, Text, UserStore } from "@webpack/common";

const cl = classNameFactory("vc-boo-");

function formatMessageDate(timestamp: string | Date): string {
    const date = new Date(timestamp);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const year = String(date.getFullYear()).slice(-2);
    return `${month}/${day}/${year}`;
}

const GroupDmsRecipientsIcon = findComponentByCodeLazy('["aria-hidden"],"aria-label":');
const SelectedChannelActionCreators = findByPropsLazy("selectPrivateChannel");

function GroupDmsIcon({ channel }: { channel: Channel; }) {
    return channel.icon ? <Avatar
        src={`https://cdn.discordapp.com/channel-icons/${channel.id}/${channel.icon}.png`}
        size="SIZE_40"
        aria-label={channel?.name || "Unnamed Group"}
    /> : <GroupDmsRecipientsIcon
        recipients={channel?.recipients ?? []}
        channel={channel}
        size="SIZE_40"
        isTyping={null}
    />;
}

interface GhostedUsersModalProps {
    modalProps: RenderModalProps;
    ghostedChannels: string[];
    onClearGhost: (channelId: string) => void;
}

export function getChannelDisplayName(channelId: string): string {
    const channel = ChannelStore.getChannel(channelId);
    if (!channel) return "Unknown";

    if (channel.isGroupDM()) {
        return channel?.name || "Unnamed Group";
    }

    // 1-on-1 DM
    const recipientId = channel?.recipients?.[0] ?? "";
    const user = UserStore.getUser(recipientId);
    return user?.username || "Unknown User";
}

export function GhostedUsersModal({ modalProps, ghostedChannels: initialChannels, onClearGhost }: GhostedUsersModalProps) {
    const [ghostedChannels, setGhostedChannels] = React.useState(initialChannels);

    const handleChannelClick = (channelId: string) => {
        const channel = ChannelStore.getChannel(channelId);
        if (channel) {
            SelectedChannelActionCreators.selectPrivateChannel(channelId);
            modalProps.onClose();
        }
    };

    const handleClearClick = (e: React.MouseEvent, channelId: string) => {
        e.stopPropagation();
        onClearGhost(channelId);
        // update local state to remove the cleared channel
        setGhostedChannels(prev => prev.filter(id => id !== channelId));
    };

    const handleClearAll = () => {
        for (const channelId of initialChannels) {
            onClearGhost(channelId);
        }
        setGhostedChannels([]);
    };

    return (
        <Modal
            {...modalProps}
            size="md"
            title={`Ghosted Users (${ghostedChannels.length})`}
            actions={ghostedChannels.length > 0 ? [
                {
                    text: "Clear All",
                    variant: "primary",
                    onClick: handleClearAll
                }
            ] : []}
        >
            <div className={cl("modal-content")}>
                {ghostedChannels.length === 0 ? (
                    <Text variant="text-md/normal">No ghosts here!</Text>
                ) : (
                    ghostedChannels.map(channelId => {
                        const channel = ChannelStore.getChannel(channelId);
                        if (!channel) return null;

                        const lastMessage = MessageStore.getMessages(channelId)?.last();
                        const lastMessageDate = lastMessage?.timestamp ? formatMessageDate(lastMessage.timestamp) : "";

                        const displayName = getChannelDisplayName(channel.id);
                        const userId = channel?.recipients?.[0] ?? "";
                        return (
                            <div
                                key={channelId}
                                onClick={() => handleChannelClick(channelId)}
                                className={cl("ghosted-entry")}
                            >
                                {channel.isGroupDM() ?
                                    <GroupDmsIcon
                                        channel={channel}
                                    /> : <Avatar
                                        src={UserStore.getUser(userId)?.getAvatarURL(undefined, 128, true)}
                                        size="SIZE_40"
                                        aria-label={displayName}
                                    />}
                                <div className={cl("user-info")}>
                                    <Text variant="text-md/normal">
                                        {displayName}
                                    </Text>
                                    {lastMessageDate && (
                                        <Text variant="text-xs/normal" className={cl("modal-text")}>
                                            {lastMessageDate}
                                        </Text>
                                    )}
                                </div>
                                <Button
                                    size={Button.Sizes.SMALL}
                                    color={Button.Colors.PRIMARY}
                                    onClick={e => handleClearClick(e, channelId)}
                                >
                                    Clear
                                </Button>
                            </div>
                        );
                    })
                )}
            </div>
        </Modal>
    );
}
