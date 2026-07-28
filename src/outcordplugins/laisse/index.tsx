/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu"
import { moveUser } from "@outcordplugins/_utils/api"
import { UserContextProps } from "@outcordplugins/_utils/types"
import { OutcordDevs } from "@utils/constants"
import definePlugin from "@utils/types"
import { VoiceState } from "@vencord/discord-types"
import { ChannelStore, Menu, React, UserStore, VoiceStateStore } from "@webpack/common"

const leashedUserIds: string[] = []

const UserContextMenuPatch: NavContextMenuPatchCallback = (children, { user }: UserContextProps) => {
    if (UserStore.getCurrentUser().id === user.id) return

    const [checked, setChecked] = React.useState(leashedUserIds.includes(user.id))

    children.push(
        <Menu.MenuCheckboxItem
            id="leash-user"
            label="Laisse"
            checked={checked}
            action={() => {
                if (leashedUserIds.includes(user.id)) {
                    leashedUserIds.filter((id) => id !== user.id)
                    setChecked(false)
                    return
                }
                leashedUserIds.push(user.id)
                const voiceState = VoiceStateStore.getVoiceStateForUser(user.id)
                const currentVoiceState = VoiceStateStore.getVoiceStateForUser(UserStore.getCurrentUser().id)
                if (voiceState?.channelId && currentVoiceState?.channelId && voiceState.channelId !== currentVoiceState.channelId) {
                    const channel = ChannelStore.getChannel(voiceState.channelId)
                    const currentChannel = ChannelStore.getChannel(currentVoiceState.channelId)
                    if (channel.guild_id === currentChannel.guild_id) {
                        moveUser(channel.guild_id, user.id, currentVoiceState.channelId)
                    }
                }
                setChecked(true)
            }}
        ></Menu.MenuCheckboxItem>,
    )
}

export default definePlugin({
    name: "Laisse",
    description: "Déplace avec toi un ou plusieurs utilisateurs quand tu te déplaces de salon vocal.",
    tags: ["Voice"],
    authors: [OutcordDevs.Out],

    flux: {
        async VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceState[] }) {
            if (leashedUserIds.length <= 0) return
            const currentVoiceState = VoiceStateStore.getVoiceStateForUser(UserStore.getCurrentUser().id)

            voiceStates.forEach((voiceState) => {
                if (voiceState?.channelId && currentVoiceState?.channelId && voiceState.channelId !== currentVoiceState.channelId) {
                    const channel = ChannelStore.getChannel(voiceState.channelId)
                    const currentChannel = ChannelStore.getChannel(currentVoiceState.channelId)
                    if (channel.guild_id === currentChannel.guild_id) {
                        moveUser(channel.guild_id, voiceState.userId, currentVoiceState.channelId)
                    }
                }
            })
        },
    },
    contextMenus: {
        "user-context": UserContextMenuPatch,
    },
})
