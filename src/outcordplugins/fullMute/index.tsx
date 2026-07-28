/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu"
import { fullMuteUser, fullUnMuteUser } from "@outcordplugins/_utils/api"
import { findArrayContainingId } from "@outcordplugins/_utils/find"
import { UserContextProps } from "@outcordplugins/_utils/types"
import { OutcordDevs } from "@utils/constants"
import definePlugin from "@utils/types"
import { Menu, PermissionsBits, PermissionStore, useStateFromStores, VoiceStateStore } from "@webpack/common"

const UserContextMenuPatch: NavContextMenuPatchCallback = (children, { user, guildId, channel }: UserContextProps) => {
    const isFullMuted = useStateFromStores([VoiceStateStore], () => {
        if (!guildId) return false
        const voiceState = VoiceStateStore.getVoiceState(guildId, user.id)
        return !!(voiceState?.mute && voiceState?.deaf)
    })

    if (!guildId) return
    const voiceState = VoiceStateStore.getVoiceState(guildId, user.id)
    if (!voiceState || !voiceState.channelId) return

    if (
        !PermissionStore.can(PermissionsBits.MUTE_MEMBERS, channel) ||
        !PermissionStore.can(PermissionsBits.DEAFEN_MEMBERS, channel)
    ) return

    const item = (
        <Menu.MenuCheckboxItem
            id="full-mute"
            label="Full Mute"
            color="danger"
            checked={isFullMuted}
            action={async () => {
                const voiceState = VoiceStateStore.getVoiceState(guildId, user.id)
                if (!voiceState || !voiceState.channelId) return
                if (voiceState.mute && voiceState.deaf) {
                    await fullUnMuteUser(guildId, user.id)
                    return
                }
                await fullMuteUser(guildId, user.id)
            }}
        />
    )

    const group = findArrayContainingId(children, "voice-deafen")
    if (group) {
        const idx = group.findIndex((c) => c?.props?.id === "voice-deafen")
        group.splice(idx + 1, 0, item)
    } else {
        children.push(item)
    }
}

export default definePlugin({
    name: "FullMute",
    description: "Mute et mute casque en même temps un utilisateur.",
    tags: ["Voice"],
    authors: [OutcordDevs.Out],

    contextMenus: {
        "user-context": UserContextMenuPatch,
    },
})
