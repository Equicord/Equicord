/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { ChannelRouter, ChannelStore, UserGuildSettingsStore } from "@webpack/common";

const settings = definePluginSettings({
    onlyWhenUnfocused: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Only automatically jump to messages when Discord's window is unfocused.",
    },
});

export default definePlugin({
    name: "AutoJumpToMessage",
    description: "Automatically opens the channel from new messages.",
    tags: ["Chat", "Utility"],
    authors: [EquicordDevs.k304],
    settings,
    flux: {
        RPC_NOTIFICATION_CREATE({ channelId }) {
            if (!channelId || settings.store.onlyWhenUnfocused && document.hasFocus()
                || UserGuildSettingsStore.isGuildOrCategoryOrChannelMuted(ChannelStore.getChannel(channelId)?.guild_id, channelId)) return;
            ChannelRouter.transitionToChannel(channelId);
        }
    },
});
