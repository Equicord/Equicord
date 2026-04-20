/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

const settings = definePluginSettings({
    logJoinLeave: {
        type: OptionType.BOOLEAN,
        description: "Log when users join, leave, or move between voice channels.",
        default: true
    },
    logMuteDeafen: {
        type: OptionType.BOOLEAN,
        description: "Log when users are server muted or deafened.",
        default: true
    },
    logVideo: {
        type: OptionType.BOOLEAN,
        description: "Log when users turn their camera on or off.",
        default: true
    },
    logStream: {
        type: OptionType.BOOLEAN,
        description: "Log when users start or stop screensharing.",
        default: true
    },
    ignoreBlockedUsers: {
        type: OptionType.BOOLEAN,
        description: "Do not log blocked users.",
        default: false
    },
});

export default settings;
