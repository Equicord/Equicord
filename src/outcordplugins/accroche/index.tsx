/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu"
import { definePluginSettings } from "@api/Settings"
import { moveUser } from "@outcordplugins/_utils/api"
import { UserContextProps } from "@outcordplugins/_utils/types"
import { OutcordDevs } from "@utils/constants"
import definePlugin, { OptionType } from "@utils/types"
import { VoiceState } from "@vencord/discord-types"
import { Menu, React, SelectedChannelStore, UserStore, useState, VoiceStateStore } from "@webpack/common"

type HookedUser = {
    userId: string
    channelId: string
}

let hookedUsers: HookedUser[] = []

const UserContextMenuPatch: NavContextMenuPatchCallback = (children, { user, guildId }: UserContextProps) => {
    if (!guildId) return
    if (UserStore.getCurrentUser().id === user.id) return

    const voiceState = VoiceStateStore.getVoiceState(guildId, user.id)
    const isHooked = hookedUsers.some((hu) => hu.userId === user.id)

    const [checked, setChecked] = useState(isHooked)
    if (!voiceState || !voiceState.channelId) return

    children.push(
        <Menu.MenuCheckboxItem
            id="hook-user"
            label="Accrocher l'utilisateur"
            checked={checked}
            action={() => {
                if (hookedUsers.some((hu) => hu.userId === user.id)) {
                    hookedUsers = hookedUsers.filter((hu) => hu.userId !== user.id)
                    setChecked(false)
                    return
                }
                hookedUsers.push({
                    userId: user.id,
                    channelId: voiceState.channelId!
                })
                setChecked(true)
            }}
        ></Menu.MenuCheckboxItem>,
    )
}

const settings = definePluginSettings({
    onlyWhenInVoice: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Accrocher l'utilisateur seulement si tu es présent dans le salon vocal.",
    },
})

export default definePlugin({
    name: "Accroche",
    description: "Empêche un utilisateur de changer de salon vocal.",
    tags: ["Voice"],
    authors: [OutcordDevs.Out],

    settings,

    flux: {
        async VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceState[] }) {
            if (hookedUsers.length <= 0) return

            voiceStates.forEach((voiceState) => {
                if (!voiceState.guildId) return
                const hookedUser = hookedUsers.find((hu) => hu.userId === voiceState.userId)
                if (!hookedUser || voiceState.channelId === hookedUser?.channelId) return
                if (settings.store.onlyWhenInVoice && SelectedChannelStore.getChannelId() !== voiceState.channelId) return

                moveUser(voiceState.guildId, voiceState.userId, hookedUser.channelId)
            })
        },
    },
    contextMenus: {
        "user-context": UserContextMenuPatch,
    },
})
