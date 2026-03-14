/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { disableStyle, enableStyle } from "@api/Styles";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { ChannelRTCStore, ChannelStore, IconUtils, UserStore, VoiceStateStore } from "@webpack/common";

import style from "./style.css?managed";

const settings = definePluginSettings({
    useServerProfileAvatars: {
        type: OptionType.BOOLEAN,
        description: "Use server profile avatars in guild voice channels when available.",
        default: false
    }
});

export default definePlugin({
    name: "FullVCPFP",
    description: "Makes avatars take up the entire vc tile",
    authors: [EquicordDevs.mochienya],
    settings,
    patches: [
        {
            find: "\"data-selenium-video-tile\":",
            replacement: {
                match: /(?<=function\((\i),\i\)\{)/,
                replace: "Object.assign($1.style=$1.style||{},$self.getVoiceBackgroundStyles($1));",
            }
        },
    ],

    getVoiceBackgroundStyles({ className, participantUserId }: { className?: string; participantUserId?: string; }) {
        if (!className?.includes("tile") || !participantUserId) return;

        const user = UserStore.getUser(participantUserId);
        if (!user) return;

        const channelId = VoiceStateStore.getVoiceStateForUser(participantUserId)?.channelId;
        if (!channelId) return;

        const guildId = ChannelStore.getChannel(channelId)?.guild_id;
        const isSpeaking = ChannelRTCStore.getSpeakingParticipants(channelId).some(p => p.user.id === participantUserId && p.speaking);
        const avatarUrl = settings.store.useServerProfileAvatars
            ? user.getAvatarURL(guildId ?? void 0, 1024, isSpeaking) ?? IconUtils.getUserAvatarURL(user, isSpeaking, 1024)
            : IconUtils.getUserAvatarURL(user, isSpeaking, 1024);

        return {
            "--full-res-avatar": `url(${avatarUrl})`
        };
    },

    start() {
        enableStyle(style);
    },
    stop() {
        disableStyle(style);
    },
});
