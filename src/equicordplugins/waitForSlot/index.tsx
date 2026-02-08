/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { currentNotice, noticesQueue, popNotice, showNotice } from "@api/Notices";
import { definePluginSettings } from "@api/Settings";
import { BaseText } from "@components/BaseText";
import { Button } from "@components/Button";
import { Paragraph } from "@components/Paragraph";
import { EquicordDevs } from "@utils/constants";
import { ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalProps, ModalRoot, ModalSize, openModal } from "@utils/modal";
import definePlugin, { OptionType } from "@utils/types";
import type { Channel } from "@vencord/discord-types";
import { ChannelType } from "@vencord/discord-types/enums";
import { GuildStore, IconUtils, Menu, SelectedChannelStore } from "@webpack/common";
import { isChannelFull, joinVoiceChannel, playNotificationSound } from "./utils/voice";

type VoiceStateChangeEvent = {
    oldChannelId?: string;
};

let waitingChannel: Channel | null = null;
let bypassPrompt = false;
let waitingNoticeOnOk: (() => void) | null = null;

const settings = definePluginSettings({
    promptOnFull: {
        type: OptionType.BOOLEAN,
        description: "Show prompt when joining a full voice channel.",
        default: true,
        restartNeeded: false
    },
    showSlotAvailablePrompt: {
        type: OptionType.BOOLEAN,
        description: "Show confirmation prompt when a slot becomes available.",
        default: true,
        restartNeeded: false
    }
});

const isVoiceChannel = (channel: Channel) =>
    channel.type === ChannelType.GUILD_VOICE || channel.type === ChannelType.GUILD_STAGE_VOICE;

const isWaiting = (channel: Channel) => waitingChannel?.id === channel.id;

type WaitPromptModalProps = {
    modalProps: ModalProps;
    title: string;
    description: string;
    channel: Channel;
    onYes: () => void;
    onNo: () => void;
};

function WaitPromptModal({ modalProps, title, description, channel, onYes, onNo }: WaitPromptModalProps) {
    const guild = channel.guild_id ? GuildStore.getGuild(channel.guild_id) : null;
    const guildIcon = guild?.icon
        ? IconUtils.getGuildIconURL({ id: guild.id, icon: guild.icon, size: 32 })
        : undefined;

    return (
        <ModalRoot {...modalProps} size={ModalSize.SMALL}>
            <ModalHeader>
                <BaseText size="lg" weight="semibold">{title}</BaseText>
                <ModalCloseButton onClick={modalProps.onClose} />
            </ModalHeader>
            <ModalContent>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    {guildIcon && <img src={guildIcon} alt="" style={{ width: 28, height: 28, borderRadius: 6 }} />}
                    <BaseText size="sm" weight="semibold">{channel.name}</BaseText>
                </div>
                <Paragraph size="md">{description}</Paragraph>
            </ModalContent>
            <ModalFooter justify="start" direction="horizontal">
                <Button
                    variant="positive"
                    size="small"
                    onClick={() => {
                        onYes();
                        modalProps.onClose();
                    }}
                >
                    Yes
                </Button>
                <Button
                    variant="dangerPrimary"
                    size="small"
                    onClick={() => {
                        onNo();
                        modalProps.onClose();
                    }}
                >
                    No
                </Button>
            </ModalFooter>
        </ModalRoot>
    );
}

function clearWaitingNotice() {
    if (!waitingNoticeOnOk) return;
    if (currentNotice?.[3] === waitingNoticeOnOk) popNotice();
    const queuedIndex = noticesQueue.findIndex(([, , , onOkClick]) => onOkClick === waitingNoticeOnOk);
    if (queuedIndex !== -1) noticesQueue.splice(queuedIndex, 1);
    waitingNoticeOnOk = null;
}

function stopWaiting() {
    waitingChannel = null;
    clearWaitingNotice();
}

const joinChannel = (channel: Channel) => {
    bypassPrompt = true;
    joinVoiceChannel(channel.id);
    bypassPrompt = false;
};

function showPrompt(channel: Channel, title: string, description: string, onYes: () => void, onNo: () => void = () => { }) {
    openModal(modalProps => (
        <WaitPromptModal
            modalProps={modalProps}
            title={title}
            description={description}
            channel={channel}
            onYes={onYes}
            onNo={onNo}
        />
    ));
}

function onSlotAvailable(channel: Channel) {
    playNotificationSound();
    if (!settings.store.showSlotAvailablePrompt) {
        joinChannel(channel);
        stopWaiting();
        return;
    }
    showPrompt(
        channel,
        "Slot available",
        `A slot is available in ${channel.name}. Would you like to join?`,
        () => {
            joinChannel(channel);
            stopWaiting();
        },
        stopWaiting
    );
}

function startWaiting(channel: Channel) {
    waitingChannel = channel;
    clearWaitingNotice();
    waitingNoticeOnOk = stopWaiting;
    showNotice(`Waiting for a Slot in VC ${channel.name}!`, "Stop Waiting", stopWaiting);
    if (!isChannelFull(channel.id, channel.userLimit)) onSlotAvailable(channel);
}

function requestWait(channel: Channel) {
    if (waitingChannel && waitingChannel.id !== channel.id) {
        showPrompt(
            channel,
            "VC is FULL",
            `You're already waiting for a slot in ${waitingChannel.name} would you like to override?`,
            () => startWaiting(channel)
        );
        return;
    }
    showPrompt(channel, "VC is FULL", `Would you like to wait for a Slot in ${channel.name}?`, () => startWaiting(channel));
}

function promptVoiceChannel(channel: Channel | null | undefined): boolean {
    if (!channel || !isVoiceChannel(channel)) return false;
    if (!settings.store.promptOnFull || bypassPrompt || isWaiting(channel)) return false;
    if (SelectedChannelStore.getVoiceChannelId() === channel.id || !isChannelFull(channel.id, channel.userLimit)) return false;
    requestWait(channel);
    return true;
}

function onVoiceStateUpdate(voiceStates: VoiceStateChangeEvent[]) {
    if (!waitingChannel) return;
    for (const state of voiceStates) {
        if (state.oldChannelId !== waitingChannel.id) continue;
        if (isChannelFull(waitingChannel.id, waitingChannel.userLimit)) continue;
        onSlotAvailable(waitingChannel);
        return;
    }
}

const VoiceChannelContext: NavContextMenuPatchCallback = (children, { channel }: { channel: Channel; }) => {
    if (!channel || !isVoiceChannel(channel)) return;
    if (SelectedChannelStore.getVoiceChannelId() === channel.id) return;

    if (isWaiting(channel)) {
        children.splice(-1, 0, (
            <Menu.MenuItem
                key="stop-waiting-for-slot"
                id="stop-waiting-for-slot"
                label="Stop waiting for slot"
                action={stopWaiting}
            />
        ));
        return;
    }

    if (isChannelFull(channel.id, channel.userLimit)) {
        children.splice(-1, 0, (
            <Menu.MenuItem
                key="wait-for-slot"
                id="wait-for-slot"
                label="Wait for Slot"
                action={() => requestWait(channel)}
            />
        ));
    }
};

export default definePlugin({
    name: "WaitForSlot",
    description: "Adds an option to calls to wait for a slot in a full voice channel.",
    authors: [EquicordDevs.omaw],
    settings,
    patches: [
        {
            find: "VoiceChannel, transitionTo: Channel does not have a guildId",
            replacement: {
                match: /(?<=\|\|\i\|\|)\i\.default\.selectVoiceChannel\((\i)\.id\)/,
                replace: "$self.promptVoiceChannel($1)||$&"
            }
        }
    ],
    contextMenus: {
        "channel-context": VoiceChannelContext,
    },
    promptVoiceChannel,
    start() { },
    flux: {
        VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceStateChangeEvent[]; }) {
            onVoiceStateUpdate(voiceStates);
        },
    },
    stop() { stopWaiting(); },
});