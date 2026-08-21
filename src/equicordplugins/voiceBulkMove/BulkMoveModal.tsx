/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { Flex } from "@components/Flex";
import { HeadingSecondary } from "@components/Heading";
import { classNameFactory } from "@utils/css";
import { Logger } from "@utils/Logger";
import { sleep } from "@utils/misc";
import type { Channel, RenderModalProps, User } from "@vencord/discord-types";
import { Avatar, ChannelStore, Checkbox, GuildChannelStore, GuildMemberStore, IconUtils, Modal, RestAPI, SearchableSelect, showToast, Toasts, UserStore, useState, useStateFromStores,VoiceStateStore } from "@webpack/common";

const cl = classNameFactory("vc-bulk-move-");
const logger = new Logger("VoiceBulkMove");

function getUserName(guildId: string, user: User) {
    return GuildMemberStore.getMember(guildId, user.id)?.nick ?? user.globalName ?? user.username;
}

export function BulkMoveModal({ modalProps, channel }: { modalProps: RenderModalProps; channel: Channel; }) {
    const [checked, setChecked] = useState<Set<string>>(new Set());
    const [targetId, setTargetId] = useState<string | null>(null);
    const [moving, setMoving] = useState(false);

    const voiceStates = useStateFromStores(
        [VoiceStateStore],
        () => VoiceStateStore.getVoiceStatesForChannel(channel.id),
        [channel.id]
    );
    const selfId = UserStore.getCurrentUser().id;
    const users = Object.values(voiceStates)
        .filter(voiceState => voiceState.userId !== selfId)
        .map(voiceState => UserStore.getUser(voiceState.userId))
        .filter((user): user is User => user != null);

    const options = GuildChannelStore.getChannels(channel.guild_id).VOCAL
        .map(({ channel: voiceChannel }) => voiceChannel)
        .filter(voiceChannel => voiceChannel.id !== channel.id)
        .map(voiceChannel => ({ label: voiceChannel.name, value: voiceChannel.id }));

    const checkedCount = [...checked].filter(userId => users.some(user => user.id === userId)).length;

    function toggleUser(userId: string) {
        setChecked(current => {
            const next = new Set(current);
            if (next.has(userId)) next.delete(userId);
            else next.add(userId);
            return next;
        });
    }

    function toggleAll() {
        const allChecked = users.length > 0 && users.every(user => checked.has(user.id));
        setChecked(new Set(allChecked ? [] : users.map(user => user.id)));
    }

    async function move() {
        if (targetId == null || checkedCount === 0 || moving) return;
        setMoving(true);
        const targetChannel = ChannelStore.getChannel(targetId);
        const userIds = [...checked].filter(userId => VoiceStateStore.getVoiceStateForUser(userId)?.channelId === channel.id);

        let moved = 0;
        for (const userId of userIds) {
            try {
                await RestAPI.patch({
                    url: `/guilds/${channel.guild_id}/members/${userId}`,
                    body: { channel_id: targetId },
                });
                moved++;
            } catch (error) {
                logger.warn(`Failed to move member ${userId}`, error);
            }
            await sleep(200);
        }
        showToast(`Moved ${moved} member${moved === 1 ? "" : "s"} to #${targetChannel?.name ?? targetId}`, Toasts.Type.SUCCESS);
        modalProps.onClose();
    }

    return (
        <Modal
            {...modalProps}
            title="Bulk move members"
            actions={[
                {
                    text: "Cancel",
                    variant: "secondary",
                    onClick: modalProps.onClose,
                    disabled: moving,
                },
                {
                    text: moving ? "Moving..." : `Move selected (${checkedCount})`,
                    variant: "primary",
                    onClick: () => void move(),
                    disabled: moving || checkedCount === 0 || targetId == null,
                },
            ]}
        >
            <Flex flexDirection="column" gap={12}>
                {users.length === 0 ? (
                    <span>No members to move.</span>
                ) : (
                    <>
                        <Checkbox type="row" value={checkedCount > 0 && checkedCount === users.length} onChange={toggleAll}>
                            Select all
                        </Checkbox>
                        <div className={cl("users")}>
                            {users.map(user => (
                                <Checkbox
                                    key={user.id}
                                    type="row"
                                    value={checked.has(user.id)}
                                    onChange={() => toggleUser(user.id)}
                                >
                                    <Flex alignItems="center" gap={8}>
                                        <Avatar src={IconUtils.getUserAvatarURL(user)} size="SIZE_32" />
                                        <span>{getUserName(channel.guild_id, user)}</span>
                                    </Flex>
                                </Checkbox>
                            ))}
                        </div>
                    </>
                )}

                <section>
                    <HeadingSecondary>Move to</HeadingSecondary>
                    <SearchableSelect
                        options={options}
                        value={targetId ?? undefined}
                        placeholder="Select a voice channel"
                        maxVisibleItems={6}
                        closeOnSelect
                        onChange={setTargetId}
                    />
                </section>
            </Flex>
        </Modal>
    );
}
