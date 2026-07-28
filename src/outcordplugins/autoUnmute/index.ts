/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { fullUnMuteUser, unDeafenUser, unMuteUser } from "@outcordplugins/_utils/api"
import { OutcordDevs } from "@utils/constants"
import definePlugin from "@utils/types"
import { VoiceState } from "@vencord/discord-types"
import { ChannelStore, PermissionsBits, PermissionStore, UserStore } from "@webpack/common"

export default definePlugin({
    name: "AutoUnmute",
    description: "Te demute automatiquement quand quelqu'un te mute ou mute casque serveur.",
    tags: ["Voice"],
    authors: [OutcordDevs.Out],

    flux: {
        async VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceState[] }) {
            const currentUser = UserStore.getCurrentUser()

            voiceStates.forEach(async (state) => {
                if (state.userId !== currentUser.id) return

                if (!state.channelId || !state.guildId) return
                if (!state.mute && !state.deaf) return

                const channel = ChannelStore.getChannel(state.channelId)
                if (!channel) return

                const canMute = PermissionStore.can(PermissionsBits.MUTE_MEMBERS, channel)
                const canDeaf = PermissionStore.can(PermissionsBits.DEAFEN_MEMBERS, channel)

                if (state.mute && state.deaf) {
                    if (canMute && canDeaf) await fullUnMuteUser(state.guildId, state.userId)
                    if (canMute) await unMuteUser(state.guildId, state.userId)
                    if (canDeaf) await unDeafenUser(state.guildId, state.userId)
                } else if (state.mute) {
                    if (canMute) await unMuteUser(state.guildId, state.userId)
                } else if (state.deaf) {
                    if (canDeaf) await unDeafenUser(state.guildId, state.userId)
                }
            })
        },
    },
})
