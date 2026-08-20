/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export const settings = definePluginSettings({
    replacementText: {
        type: OptionType.STRING,
        default: "** **",
        description: "Replacement Text"
    },
    suppressNotifications: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Suppress Notifications"
    },
    deleteDelay: {
        type: OptionType.NUMBER,
        default: 200,
        description: "Delete Delay (ms)"
    }
});
