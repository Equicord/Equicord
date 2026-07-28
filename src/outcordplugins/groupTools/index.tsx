/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { addToGroup, leaveGroup, removeFromGroup } from "@outcordplugins/_utils/api";
import { UserContextProps } from "@outcordplugins/_utils/types";
import { OutcordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { User } from "@vencord/discord-types";
import { ChannelStore, Checkbox, ConfirmModal, Menu, openModal, RelationshipStore, UserStore, useState } from "@webpack/common";

const channelContextMenuPatch: NavContextMenuPatchCallback = (children, { channel }: UserContextProps) => {
    const { lockedGroups } = settings.use(["lockedGroups"])

    const [isGroupeLocked, setIsGroupLocked] = useState<boolean>(Object.keys(lockedGroups).includes(channel.id))

    children.push(
        <Menu.MenuItem
            id="group-tools"
            label="Group Tools"
        >
            <Menu.MenuItem
                id="group-tools-kick-all"
                label="Kick all"
                disabled={!channel.isOwner(UserStore.getCurrentUser().id)}
                action={() => {
                    openModal((props) => (
                        <ConfirmModal
                            {...props}
                            transitionState={props.transitionState}
                            variant="critical-primary"
                            title="Êtes-vous sûr de vouloir éxplulser tout le monde du groupe ?"
                            confirmText="Confirmer"
                            cancelText="Annuler"
                            onConfirm={(setError) => {
                                if (!channel.isOwner(UserStore.getCurrentUser().id)) {
                                    setError("Tu n'es pas propriétaire de ce groupe.")
                                    throw Error()
                                }
                                channel.recipients.forEach((uId) => {
                                    if (uId === UserStore.getCurrentUser().id) return
                                    removeFromGroup(channel.id, uId)
                                })
                            }}
                            onClose={props.onClose}
                        />
                    ))
                }}
            />
            <Menu.MenuCheckboxItem
                id="group-tools-lock"
                label="Vérouiller"
                checked={isGroupeLocked}
                action={() => {
                    if (!Object.keys(lockedGroups).includes(channel.id)) {
                        const group = ChannelStore.getChannel(channel.id)
                        settings.store.lockedGroups = {
                            ...settings.store.lockedGroups,
                            [channel.id]: group.recipients
                        }
                        setIsGroupLocked(true)
                    } else {
                        const { [channel.id]: _, ...rest } = settings.store.lockedGroups
                        settings.store.lockedGroups = rest
                        setIsGroupLocked(false)
                    }
                }}
            />
            <Menu.MenuItem
                id="group-tools-leave-all"
                label="Leave all"
                color="danger"
                action={() => {
                    openModal((props) => <LeaveAllModal {...props} />)
                }}
            />
        </Menu.MenuItem>
    )
}

function LeaveAllModal(props: any) {
    const [silentLeaveAll, setSilentLeaveAll] = useState<boolean>(false)

    return (
        <ConfirmModal
            {...props}
            transitionState={props.transitionState}
            variant="critical-primary"
            title="Êtes-vous sûr de vouloir quitter tous les groupes ?"
            confirmText="Confirmer"
            cancelText="Annuler"
            onConfirm={() => {
                const groups = ChannelStore.getChannelIds(null).filter((id) => ChannelStore.getChannel(id).isGroupDM())
                groups.forEach((id) => {
                    leaveGroup(id, silentLeaveAll)
                })
            }}
            onClose={props.onClose}
        >
            <Checkbox
                value={silentLeaveAll}
                onChange={(_e, v) => setSilentLeaveAll(v)}
            >
                Quitter silencieusement
            </Checkbox>
        </ConfirmModal>
    );
}

const settings = definePluginSettings({
    lockedGroups: {
        type: OptionType.CUSTOM,
        default: {} as Record<string, string[]>,
        description: ""
    }
})

export default definePlugin({
    name: "GroupTools",
    description: "Permet de faire des actions sur les groupes (verouiller, quitter tous, etc.)",
    authors: [OutcordDevs.Out],

    settings,

    contextMenus: {
        "gdm-context": channelContextMenuPatch
    },

    flux: {
        CHANNEL_RECIPIENT_ADD({ channelId, user }: { channelId: string, user: User }) {
            const lockedGroupUsers = settings.store.lockedGroups[channelId]
            if (lockedGroupUsers && !lockedGroupUsers.includes(user.id) && ChannelStore.getChannel(channelId).isOwner(UserStore.getCurrentUser().id)) {
                removeFromGroup(channelId, user.id)
            }
        },
        CHANNEL_RECIPIENT_REMOVE({ channelId, user }: { channelId: string, user: User }) {
            const lockedGroupUsers = settings.store.lockedGroups[channelId]
            if (lockedGroupUsers && lockedGroupUsers.includes(user.id) && RelationshipStore.isFriend(user.id)) {
                addToGroup(channelId, user.id)
            }
        }
    }
})
