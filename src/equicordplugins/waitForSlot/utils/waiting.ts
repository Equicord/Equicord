import { sendBotMessage } from "@api/Commands";
import { currentNotice, noticesQueue, popNotice, showNotice } from "@api/Notices";
import { Logger } from "@utils/Logger";
import { openModal } from "@utils/modal";
import type { Channel } from "@vencord/discord-types";
import type { ReactNode } from "react";
import { Button } from "@components/Button";
import { NavigationRouter, React } from "@webpack/common";

import { ReplaceQueueModal } from "../components/ReplaceQueueModal";
import { SlotAvailableModalSimple } from "../components/SlotAvailableModalSimple";
import { WaitPromptModal } from "../components/WaitPromptModal";
import { settings } from "../settings";
import { isChannelFull, joinVoiceChannel, playNotificationSound } from "./voice";

const logger = new Logger("WaitForSlot");
const waitingChannels = new Set<Channel>();
let bypassPrompt = false;
let waitingNoticeMessage: ReactNode | null = null;
let waitingNoticeKey: string | null = null;
let waitingNoticeOnOk: (() => void) | null = null;

const noop = () => { };

export function isWaiting(channel: Channel) {
    return waitingChannels.has(channel);
}

export function hasWaitingChannels() {
    return waitingChannels.size > 0;
}

export function getWaitingChannels() {
    return waitingChannels;
}

function attemptJoin(channelId: string) {
    try {
        bypassPrompt = true;
        joinVoiceChannel(channelId);
    } catch (error) {
        logger.error("Failed to join voice channel", error);
    } finally {
        bypassPrompt = false;
    }
}

function dismissWaitingNotice() {
    if (!waitingNoticeMessage || !waitingNoticeOnOk) return;
    if (currentNotice?.[3] === waitingNoticeOnOk) popNotice();
    const queuedIndex = noticesQueue.findIndex(([, , , onOkClick]) => onOkClick === waitingNoticeOnOk);
    if (queuedIndex !== -1) noticesQueue.splice(queuedIndex, 1);
    waitingNoticeMessage = null;
    waitingNoticeKey = null;
    waitingNoticeOnOk = null;
}

function showWaitingNotice(channel: Channel) {
    const message = React.createElement(
        "div",
        { className: "vc-wfs-notice" },
        React.createElement(
            "span",
            { className: "vc-wfs-notice-text" },
            `Waiting for a Slot in ${channel.name}`
        ),
        React.createElement(
            "div",
            { className: "vc-wfs-notice-actions" },
            React.createElement(
                Button,
                {
                    size: "small",
                    variant: "secondary",
                    onClick: () => {
                        const guildId = channel.guild_id ?? "@me";
                        NavigationRouter.transitionTo(`/channels/${guildId}/${channel.id}`);
                    },
                },
                "Jump"
            )
        )
    );
    dismissWaitingNotice();
    const onStop = () => {
        if (waitingNoticeKey === channel.id) dismissWaitingNotice();
        stopWaiting();
    };
    waitingNoticeMessage = message;
    waitingNoticeKey = channel.id;
    waitingNoticeOnOk = onStop;
    showNotice(message, "Stop Waiting", onStop);
}

export function stopWaiting() {
    waitingChannels.clear();
    dismissWaitingNotice();
}

export function removeWaiting(channel: Channel, sendMessage = true) {
    waitingChannels.delete(channel);
    if (sendMessage) {
        sendBotMessage(channel.id, { content: `Stopped waiting for a free slot in <#${channel.id}>` });
    }
    if (waitingChannels.size === 0) return stopWaiting();
    const nextChannel = waitingChannels.values().next().value as Channel | undefined;
    if (nextChannel) showWaitingNotice(nextChannel);
}

export function shouldPromptForChannel(channel: Channel): boolean {
    return settings.store.promptOnFull
        && !bypassPrompt
        && isChannelFull(channel.id, channel.userLimit);
}

export function promptToWait(channel: Channel) {
    openModal(modalProps => React.createElement(WaitPromptModal, {
        modalProps,
        channel,
        onWait: () => waitForChannel(channel),
        onDecline: noop,
    }));
}

export function waitForChannel(channel: Channel) {
    if (waitingChannels.has(channel)) return;
    if (settings.store.promptOnReplace && waitingChannels.size > 0) {
        openModal(modalProps => React.createElement(ReplaceQueueModal, {
            modalProps,
            channel,
            onReplace: () => {
                dismissWaitingNotice();
                waitingChannels.clear();
                waitingChannels.add(channel);
                sendBotMessage(channel.id, { content: `Started waiting for a free slot in <#${channel.id}>` });
                showWaitingNotice(channel);
            },
        }));
        return;
    }
    waitingChannels.add(channel);
    sendBotMessage(channel.id, { content: `Started waiting for a free slot in <#${channel.id}>` });
    showWaitingNotice(channel);
    if (!isChannelFull(channel.id, channel.userLimit)) joinAvailable(channel);
}

export function joinAvailable(channel: Channel) {
    waitingChannels.clear();
    dismissWaitingNotice();
    if (settings.store.playSound) playNotificationSound();

    if (settings.store.showConfirmation) {
        openModal(modalProps => React.createElement(SlotAvailableModalSimple, {
            modalProps,
            channel,
            onJoin: () => attemptJoin(channel.id),
        }));
        return;
    }
    attemptJoin(channel.id);
}
