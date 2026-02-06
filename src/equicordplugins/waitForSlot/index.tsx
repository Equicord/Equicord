/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import type { Channel } from "@vencord/discord-types";
import { ChannelType } from "@vencord/discord-types/enums";
import { findByPropsLazy } from "@webpack";
import { ChannelStore, Menu, SelectedChannelStore } from "@webpack/common";
import { settings } from "./settings";
import { isChannelFull } from "./utils/voice";
import { getWaitingChannels, hasWaitingChannels, isWaiting, joinAvailable, promptToWait, removeWaiting, shouldPromptForChannel, stopWaiting, waitForChannel } from "./utils/waiting";
import managedStyle from "./styles.css?managed";

interface VoiceStateChangeEvent {
    channelId?: string;
    oldChannelId?: string;
}

const waitingChannels = getWaitingChannels();
type SelectVoiceChannel = (channelId: string | null, ...args: unknown[]) => unknown;
type SelectChannel = (channelId: string | null, ...args: unknown[]) => unknown;
let selectVoiceChannelDescriptor: PropertyDescriptor | null = null;
let rawSelectVoiceChannel: SelectVoiceChannel | null = null;
let selectChannelDescriptor: PropertyDescriptor | null = null;
let rawSelectChannel: SelectChannel | null = null;
let selectVoiceChannelPatchInterval: number | null = null;
let isSelectVoiceChannelPatched = false;
let isSelectChannelPatched = false;
const ChannelActions = findByPropsLazy("selectChannel", "selectVoiceChannel") as {
    selectVoiceChannel?: SelectVoiceChannel;
    selectChannel?: SelectChannel;
};

const isVoiceChannel = (channel: Channel) =>
    channel.type === ChannelType.GUILD_VOICE || channel.type === ChannelType.GUILD_STAGE_VOICE;

const shouldInterceptChannel = (channel: Channel) =>
    isVoiceChannel(channel)
    && SelectedChannelStore.getVoiceChannelId() !== channel.id
    && !isWaiting(channel)
    && shouldPromptForChannel(channel);

function onVoiceStateUpdate(voiceStates: VoiceStateChangeEvent[]) {
    if (!hasWaitingChannels()) return;
    for (const state of voiceStates) {
        if (!state.oldChannelId) continue;
        let waiting: Channel | undefined;
        for (const channel of waitingChannels) {
            if (channel.id === state.oldChannelId) {
                waiting = channel;
                break;
            }
        }
        if (waiting && !isChannelFull(waiting.id, waiting.userLimit)) {
            joinAvailable(waiting);
            return;
        }
    }
}

function wrapSelectVoiceChannel(fn: SelectVoiceChannel): SelectVoiceChannel {
    return (channelId: string | null, ...args: unknown[]) => {
        if (channelId == null) return fn(channelId, ...args);
        const channel = ChannelStore.getChannel(channelId) as Channel | null;
        if (!channel || !shouldInterceptChannel(channel)) return fn(channelId, ...args);
        promptToWait(channel);
    };
}

function wrapSelectChannel(fn: SelectChannel): SelectChannel {
    return (channelId: string | null, ...args: unknown[]) => {
        if (channelId == null) return fn(channelId, ...args);
        const channel = ChannelStore.getChannel(channelId) as Channel | null;
        if (!channel || !shouldInterceptChannel(channel)) return fn(channelId, ...args);
        promptToWait(channel);
    };
}

function patchSelectVoiceChannel(): boolean {
    if (isSelectVoiceChannelPatched) return true;
    const current = ChannelActions.selectVoiceChannel;
    if (typeof current !== "function") return false;
    const descriptor = Object.getOwnPropertyDescriptor(ChannelActions, "selectVoiceChannel");
    let raw = current;
    let wrapped = wrapSelectVoiceChannel(current);
    Object.defineProperty(ChannelActions, "selectVoiceChannel", {
        configurable: true,
        enumerable: descriptor?.enumerable ?? true,
        get: () => wrapped,
        set: (fn: SelectVoiceChannel) => {
            raw = fn;
            wrapped = wrapSelectVoiceChannel(fn);
        },
    });
    selectVoiceChannelDescriptor = descriptor ?? null;
    rawSelectVoiceChannel = raw;
    isSelectVoiceChannelPatched = true;
    return true;
}

function patchSelectChannel(): boolean {
    if (isSelectChannelPatched) return true;
    const current = ChannelActions.selectChannel;
    if (typeof current !== "function") return false;
    const descriptor = Object.getOwnPropertyDescriptor(ChannelActions, "selectChannel");
    let raw = current;
    let wrapped = wrapSelectChannel(current);
    Object.defineProperty(ChannelActions, "selectChannel", {
        configurable: true,
        enumerable: descriptor?.enumerable ?? true,
        get: () => wrapped,
        set: (fn: SelectChannel) => {
            raw = fn;
            wrapped = wrapSelectChannel(fn);
        },
    });
    selectChannelDescriptor = descriptor ?? null;
    rawSelectChannel = raw;
    isSelectChannelPatched = true;
    return true;
}

function installChannelActionPatch(): boolean {
    patchSelectVoiceChannel();
    patchSelectChannel();

    const voiceReady = typeof ChannelActions?.selectVoiceChannel === "function";
    const channelReady = typeof ChannelActions?.selectChannel === "function";
    return (voiceReady ? isSelectVoiceChannelPatched : false)
        && (channelReady ? isSelectChannelPatched : false);
}

const VoiceChannelContext: NavContextMenuPatchCallback = (children, { channel }: { channel: Channel; }) => {
    if (!channel || (channel.type !== ChannelType.GUILD_VOICE && channel.type !== ChannelType.GUILD_STAGE_VOICE)) return;
    if (SelectedChannelStore.getVoiceChannelId() === channel.id) return;

    if (isWaiting(channel)) {
        children.splice(-1, 0, (
            <Menu.MenuItem
                key="stop-waiting-for-slot"
                id="stop-waiting-for-slot"
                label="Stop waiting for slot"
                action={() => removeWaiting(channel)}
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
                action={() => waitForChannel(channel)}
            />
        ));
    }
};

export default definePlugin({
    name: "WaitForSlot",
    description: "Adds an option to calls to wait for a slot in a full voice channel.",
    authors: [EquicordDevs.omaw],
    managedStyle,
    settings,
    contextMenus: {
        "channel-context": VoiceChannelContext,
    },
    start() {
        if (installChannelActionPatch()) return;
        selectVoiceChannelPatchInterval = window.setInterval(() => {
            if (installChannelActionPatch() && selectVoiceChannelPatchInterval != null) {
                clearInterval(selectVoiceChannelPatchInterval);
                selectVoiceChannelPatchInterval = null;
            }
        }, 1000);
    },
    flux: {
        VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceStateChangeEvent[]; }) {
            onVoiceStateUpdate(voiceStates);
        },
    },
    stop() {
        stopWaiting();
        if (selectVoiceChannelPatchInterval != null) {
            clearInterval(selectVoiceChannelPatchInterval);
            selectVoiceChannelPatchInterval = null;
        }
        if (isSelectVoiceChannelPatched) {
            if (selectVoiceChannelDescriptor) {
                Object.defineProperty(ChannelActions, "selectVoiceChannel", selectVoiceChannelDescriptor);
            } else if (rawSelectVoiceChannel) {
                ChannelActions.selectVoiceChannel = rawSelectVoiceChannel;
            }
            selectVoiceChannelDescriptor = null;
            rawSelectVoiceChannel = null;
            isSelectVoiceChannelPatched = false;
        }
        if (isSelectChannelPatched) {
            if (selectChannelDescriptor) {
                Object.defineProperty(ChannelActions, "selectChannel", selectChannelDescriptor);
            } else if (rawSelectChannel) {
                ChannelActions.selectChannel = rawSelectChannel;
            }
            selectChannelDescriptor = null;
            rawSelectChannel = null;
            isSelectChannelPatched = false;
        }
    },
});
