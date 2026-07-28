/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu"
import { definePluginSettings } from "@api/Settings"
import { UserContextProps } from "@outcordplugins/_utils/types"
import { EquicordDevs, OutcordDevs } from "@utils/constants"
import definePlugin, { OptionType } from "@utils/types"
import { VoiceState } from "@vencord/discord-types"
import { findByPropsLazy } from "@webpack"
import { Menu, React, UserStore, VoiceStateStore } from "@webpack/common"

const voiceChannelAction = findByPropsLazy("selectVoiceChannel")

type TFollowedUserInfo = {
    lastChannelId: string
    userId: string
} | null

let followedUserInfo: TFollowedUserInfo = null

const UserContextMenuPatch: NavContextMenuPatchCallback = (children, { user }: UserContextProps) => {
    if (UserStore.getCurrentUser().id === user.id) return

    const [checked, setChecked] = React.useState(followedUserInfo?.userId === user.id)

    children.push(
        <Menu.MenuCheckboxItem
            id="follow-user"
            label="Follow User"
            checked={checked}
            action={() => {
                if (followedUserInfo?.userId === user.id) {
                    followedUserInfo = null
                    setChecked(false)
                    return
                }
                followedUserInfo = {
                    lastChannelId: UserStore.getCurrentUser().id,
                    userId: user.id,
                }
                setChecked(true)
            }}
        ></Menu.MenuCheckboxItem>,
    )
}

const settings = definePluginSettings({
    onlyWhenInVoice: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Suivre l'utilisateur seulement si tu es en vocal.",
    },
    leaveWhenUserLeaves: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Quitter quand l'utilisateur quitte.",
    },
})

export default definePlugin({
    name: "FollowUser",
    description: "Suivre un utilisateur en vocal. (pas seulement un ami)",
    tags: ["Voice"],
    authors: [EquicordDevs.TheArmagan, OutcordDevs.Out],

    settings,

    flux: {
        async VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceState[] }) {
            if (!followedUserInfo) return
            if (settings.store.onlyWhenInVoice && !VoiceStateStore.getVoiceStateForUser(UserStore.getCurrentUser().id)) return

            voiceStates.forEach((voiceState) => {
                if (voiceState.userId === followedUserInfo!.userId && voiceState.channelId && voiceState.channelId !== followedUserInfo!.lastChannelId) {
                    followedUserInfo!.lastChannelId = voiceState.channelId
                    voiceChannelAction.selectVoiceChannel(followedUserInfo!.lastChannelId)
                } else if (voiceState.userId === followedUserInfo!.userId && !voiceState.channelId && settings.store.leaveWhenUserLeaves) {
                    voiceChannelAction.selectVoiceChannel(null)
                }
            })
        },
    },
    contextMenus: {
        "user-context": UserContextMenuPatch,
    },
})
