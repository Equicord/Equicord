/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { Notice } from "@components/Notice";
import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { Channel, User, VoiceState } from "@vencord/discord-types";
import { findStoreLazy } from "@webpack";
import { ChannelStore, Menu, RestAPI, Toasts, VoiceStateStore } from "@webpack/common";

interface UserContextProps {
    channel: Channel;
    user: User;
    guildId?: string;
}

const UserStore = findStoreLazy("UserStore");

const draggedUsers = new Map<string, { userId: string; guildId: string; }>();

async function moveUserToChannel(guildId: string, userId: string, channelId: string) {
    try {
        await RestAPI.patch({
            url: `/guilds/${guildId}/members/${userId}`,
            body: { channel_id: channelId }
        });
    } catch {
        Toasts.show({
            message: "Oops! Something went wrong.",
            id: Toasts.genId(),
            type: Toasts.Type.FAILURE
        });
    }
}

const UserContextMenuPatch: NavContextMenuPatchCallback = (children, { user }: UserContextProps) => {
    const currentUser: User = UserStore.getCurrentUser();
    if (!user || user.id === currentUser.id) return;

    const targetVoiceState: VoiceState | undefined = VoiceStateStore.getVoiceStateForUser(user.id);
    if (!targetVoiceState?.channelId) return;

    const channel = ChannelStore.getChannel(targetVoiceState.channelId);
    if (!channel?.guild_id) return;

    const isDragging = draggedUsers.has(user.id);

    const dragItem = (
        <Menu.MenuCheckboxItem
            id="vc-voice-drag"
            label="Drag with me"
            checked={isDragging}
            action={() => {
                if (draggedUsers.has(user.id)) {
                    draggedUsers.delete(user.id);
                } else {
                    draggedUsers.set(user.id, {
                        userId: user.id,
                        guildId: channel.guild_id
                    });
                }
            }}
        />
    );

    const followIdx = children.findIndex((c: any) => c?.props?.id === "fvu-follow-user");
    if (followIdx !== -1) {
        children.splice(followIdx + 1, 0, dragItem);
    } else {
        children.push(<Menu.MenuSeparator />, dragItem);
    }
};

export default definePlugin({
    name: "VoiceDrag",
    description: "Drags selected users to your voice channel as you move around.",
    tags: ["Voice"],
    authors: [EquicordDevs.NOobzy],
    dependencies: ["UserAreaAPI"],
    settingsAboutComponent: () => (
        <Notice.Info>
            This plugin drags selected users to your voice channel as you move around.
        </Notice.Info>
    ),

    contextMenus: {
        "user-context": UserContextMenuPatch
    },

    flux: {
        async VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceState[]; }) {
            if (draggedUsers.size === 0) return;

            const currentUserId: string = UserStore.getCurrentUser().id;

            for (const voiceState of voiceStates) {
                if (voiceState.userId !== currentUserId) continue;
                if (!voiceState.channelId) continue;

                const channel = ChannelStore.getChannel(voiceState.channelId);
                if (!channel?.guild_id) continue;

                for (const [userId, info] of draggedUsers) {
                    if (info.guildId !== channel.guild_id) continue;
                    const targetState: VoiceState | undefined = VoiceStateStore.getVoiceStateForUser(userId);
                    if (targetState?.channelId === voiceState.channelId) continue;

                    await moveUserToChannel(channel.guild_id, userId, voiceState.channelId);
                }
            }
        }
    },

    stop() {
        draggedUsers.clear();
    }
});
