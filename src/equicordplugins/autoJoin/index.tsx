/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { UserAreaButton, UserAreaRenderProps } from "@api/UserArea";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { makeRange, OptionType } from "@utils/types";
import { VoiceState } from "@vencord/discord-types";
import { findByPropsLazy, findExportedComponentLazy } from "@webpack";
import { UserStore, VoiceStateStore } from "@webpack/common";

const BadgeIcon = findExportedComponentLazy("BadgeIcon");
const voiceChannelAction = findByPropsLazy("selectVoiceChannel");

let lastChannelId: string | null = null;

const settings = definePluginSettings({
    active: {
        type: OptionType.BOOLEAN,
        description: "Automatically rejoin your voice channel after being disconnected.",
        default: false
    },
    rejoinDelay: {
        type: OptionType.SLIDER,
        description: "Delay in seconds before rejoining the voice channel.",
        markers: makeRange(1, 10, 1),
        default: 2,
        stickToMarkers: true
    }
});

function Icon({ className }: { className?: string; }) {
    const { active } = settings.use(["active"]);

    return (
        <BadgeIcon
            className={className}
            color={active ? "currentColor" : "var(--status-danger)"}
            width={20}
            height={20}
        />
    );
}

function AutoJoinButton({ iconForeground, hideTooltips, nameplate }: UserAreaRenderProps) {
    const { active } = settings.use(["active"]);

    return (
        <UserAreaButton
            tooltipText={hideTooltips ? void 0 : active ? "Disable Auto-Join" : "Enable Auto-Join"}
            icon={<Icon className={iconForeground} />}
            role="switch"
            aria-checked={active}
            redGlow={!active}
            plated={nameplate != null}
            onClick={() => { settings.store.active = !settings.store.active; }}
        />
    );
}

export default definePlugin({
    name: "AutoJoin",
    description: "Automatically rejoin your voice channel after being disconnected. Toggle the button next to mute/deafen to enable.",
    tags: ["Voice", "Utility"],
    authors: [EquicordDevs.NOobzy],
    dependencies: ["UserAreaAPI"],
    settings,

    userAreaButton: {
        icon: Icon,
        render: AutoJoinButton
    },

    flux: {
        VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceState[]; }) {
            const currentUser = UserStore.getCurrentUser();
            if (!currentUser) return;

            const myState = voiceStates.find(s => s.userId === currentUser.id);
            if (!myState) return;

            if (myState.channelId) {
                lastChannelId = myState.channelId;
            } else if (lastChannelId && settings.store.active) {
                const channelToRejoin = lastChannelId;
                setTimeout(() => {
                    const currentState = VoiceStateStore.getVoiceStateForUser(currentUser.id);
                    if (currentState?.channelId) return;
                    voiceChannelAction.selectVoiceChannel(channelToRejoin);
                }, settings.store.rejoinDelay * 1000);
            }
        }
    }
});
