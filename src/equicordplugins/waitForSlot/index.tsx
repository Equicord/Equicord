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
import { Menu, SelectedChannelStore } from "@webpack/common";
import { settings } from "./settings";
import { isChannelFull } from "./utils/voice";
import { getWaitingChannels, hasWaitingChannels, isWaiting, joinAvailable, promptToWait, removeWaiting, shouldPromptForChannel, stopWaiting, waitForChannel } from "./utils/waiting";
import managedStyle from "./styles.css?managed";

interface VoiceStateChangeEvent {
    channelId?: string;
    oldChannelId?: string;
}

const waitingChannels = getWaitingChannels();

const isVoiceChannel = (channel: Channel) =>
    channel.type === ChannelType.GUILD_VOICE || channel.type === ChannelType.GUILD_STAGE_VOICE;

const shouldInterceptChannel = (channel: Channel) =>
    isVoiceChannel(channel)
    && SelectedChannelStore.getVoiceChannelId() !== channel.id
    && !isWaiting(channel)
    && shouldPromptForChannel(channel);

function promptVoiceChannel(channel: Channel | null | undefined): boolean {
    if (!channel || !shouldInterceptChannel(channel)) return false;
    promptToWait(channel);
    return true;
}

function onVoiceStateUpdate(voiceStates: VoiceStateChangeEvent[]) {
    if (!hasWaitingChannels()) return;
    for (const state of voiceStates) {
        if (!state.oldChannelId) continue;
        let waiting: Channel | undefined;
        for (const channel of waitingChannels.values()) {
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
    stop() {
        stopWaiting();
    },
});
