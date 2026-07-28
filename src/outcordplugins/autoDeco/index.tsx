/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu"
import { disconnectUser } from "@outcordplugins/_utils/api"
import { UserContextProps } from "@outcordplugins/_utils/types"
import { EquicordDevs, OutcordDevs } from "@utils/constants"
import definePlugin from "@utils/types"
import { VoiceState } from "@vencord/discord-types"
import { Menu, React, UserStore } from "@webpack/common"

let disconnectUserIds: string[] = []

const UserContextMenuPatch: NavContextMenuPatchCallback = (children, { user, guildId }: UserContextProps) => {
    if (UserStore.getCurrentUser().id === user.id) return

    const [checked, setChecked] = React.useState(disconnectUserIds.includes(user.id))

    children.push(
        <Menu.MenuSeparator />,
        <Menu.MenuCheckboxItem
            id="auto-disconnect"
            label="Auto Disconnect"
            checked={checked}
            action={async () => {
                if (disconnectUserIds.includes(user.id)) {
                    disconnectUserIds = disconnectUserIds.filter((uId) => uId !== user.id)
                    setChecked(false)
                    return
                }
                disconnectUserIds.push(user.id)
                if (guildId) await disconnectUser(guildId, user.id)
                setChecked(true)
            }}
        ></Menu.MenuCheckboxItem>,
    )
}

export default definePlugin({
    name: "AutoDeco",
    description: "Déconnecter quelqu'un à chaque fois qu'il rejoint un salon. Work across all devices. Reload the page to reset pings. ",
    tags: ["Voice"],
    authors: [EquicordDevs.TheArmagan, OutcordDevs.Out],

    flux: {
        async VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceState[] }) {
            if (disconnectUserIds.length === 0) return

            voiceStates.forEach(async (voiceState) => {
                if (!voiceState.guildId || !voiceState.channelId || !disconnectUserIds.includes(voiceState.userId)) return
                await disconnectUser(voiceState.guildId, voiceState.userId)
            })
        },
    },
    contextMenus: {
        "user-context": UserContextMenuPatch,
    },
})
