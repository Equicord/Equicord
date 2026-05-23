/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export const settings = definePluginSettings({
    editDiff: {
        type: OptionType.BOOLEAN,
        description: "Show word-level diff button on edited messages",
        default: true,
    },
    replyTree: {
        type: OptionType.BOOLEAN,
        description: "Show reply tree button to list all replies to a message",
        default: true,
    },
    channelBrief: {
        type: OptionType.BOOLEAN,
        description: "Show new messages preview when returning to a channel after inactivity",
        default: true,
    },
    briefThresholdMinutes: {
        type: OptionType.NUMBER,
        description: "Minutes of inactivity before showing channel brief (default: 15)",
        default: 15,
    },
    briefPreviewCount: {
        type: OptionType.NUMBER,
        description: "Number of messages to preview in channel brief (3, 5, or 10)",
        default: 5,
    },
});
