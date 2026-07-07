/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

import { FriendTrackingSetting } from "./components";
import { MessageCountModes } from "./types";

export const settings = definePluginSettings({
    sortMode: {
        type: OptionType.BOOLEAN,
        description: "Sort by messages instead of friendship duration",
        default: false
    },
    sortDescending: {
        type: OptionType.BOOLEAN,
        description: "Show highest ranked friends first",
        default: true
    },
    messageCountMode: {
        type: OptionType.SELECT,
        description: "Which messages should be counted?",
        options: [
            { label: "Sent messages", value: MessageCountModes.SENT, default: true },
            { label: "Received messages", value: MessageCountModes.RECEIVED },
            { label: "All messages", value: MessageCountModes.ALL }
        ]
    },
    trackedFriendIds: {
        type: OptionType.COMPONENT,
        default: [] satisfies string[],
        component: FriendTrackingSetting
    }
});
