/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { OutcordDevs } from "@utils/constants"
import definePlugin from "@utils/types"
import { VoiceState } from "@vencord/discord-types"
import { findByPropsLazy, findStoreLazy } from "@webpack"
import { UserStore } from "@webpack/common"

const VoiceStateStore = findStoreLazy("VoiceStateStore")
const ChannelActions = findByPropsLazy("selectVoiceChannel")

let wasInVoice: boolean | null = null
let isVoluntaryDisconnect: boolean = false
let isChannelSwitching: boolean = false
let originalSelectVoiceChannel: any = null
let disconnectTimeout: NodeJS.Timeout | null = null
let switchTimeout: NodeJS.Timeout | null = null

function markVoluntaryDisconnect() {
    isVoluntaryDisconnect = true
    if (disconnectTimeout) clearTimeout(disconnectTimeout)
    disconnectTimeout = setTimeout(() => {
        isVoluntaryDisconnect = false
    }, 3000)
}

function markChannelSwitch() {
    isChannelSwitching = true
    if (switchTimeout) clearTimeout(switchTimeout)
    switchTimeout = setTimeout(() => {
        isChannelSwitching = false
    }, 3000)
}

export default definePlugin({
    name: "AntiDeco",
    description: "Reconnecte automatiquement au salon vocal dans lequel tu étais.",
    tags: ["Voice"],
    authors: [{ name: "Bash", id: 1327483363518582784n }, OutcordDevs.Out],

    flux: {
        VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceState[] }) {
            const currentUser = UserStore.getCurrentUser()

            for (const state of voiceStates) {
                if (state.userId !== currentUser.id) continue

                if (state.oldChannelId && !state.channelId && wasInVoice) {
                    if (isVoluntaryDisconnect || isChannelSwitching) return

                    setTimeout(() => {
                        if (isVoluntaryDisconnect || isChannelSwitching) return

                        const currentState = VoiceStateStore.getVoiceStateForUser(currentUser.id)
                        if (currentState?.channelId) return

                        if (originalSelectVoiceChannel) originalSelectVoiceChannel.call(ChannelActions, state.oldChannelId)
                        else ChannelActions.selectVoiceChannel(state.oldChannelId)
                    }, 200)
                }
            }
        },
        VOICE_CHANNEL_SELECT({ channelId }: { channelId: string | null }) {
            wasInVoice = !!channelId
            const currentUser = UserStore.getCurrentUser()
            const currentVoiceState = VoiceStateStore.getVoiceStateForUser(currentUser.id)

            if (currentVoiceState?.channelId) {
                if (channelId === null) markVoluntaryDisconnect()
                else markChannelSwitch()
            }
        },
    },

    start() {
        if (!ChannelActions || !VoiceStateStore) return

        originalSelectVoiceChannel = ChannelActions.selectVoiceChannel

        ChannelActions.selectVoiceChannel = function (channelId: string | null) {
            const currentUser = UserStore.getCurrentUser()
            if (!currentUser) return originalSelectVoiceChannel.call(this, channelId)

            const currentVoiceState = VoiceStateStore.getVoiceStateForUser(currentUser.id)

            if (currentVoiceState?.channelId) {
                if (channelId === null) markVoluntaryDisconnect()
                else if (channelId !== currentVoiceState.channelId) markChannelSwitch()
            }

            return originalSelectVoiceChannel.call(this, channelId)
        }
    },

    stop() {
        if (originalSelectVoiceChannel && ChannelActions) {
            ChannelActions.selectVoiceChannel = originalSelectVoiceChannel
            originalSelectVoiceChannel = null
        }

        if (disconnectTimeout) {
            clearTimeout(disconnectTimeout)
            disconnectTimeout = null
        }
        if (switchTimeout) {
            clearTimeout(switchTimeout)
            switchTimeout = null
        }
        isVoluntaryDisconnect = false
        isChannelSwitching = false
        wasInVoice = null
    },
})
