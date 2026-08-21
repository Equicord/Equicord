/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export const settings = definePluginSettings({
    prettyPrintJson: {
        type: OptionType.BOOLEAN,
        description: "Pretty print JSON by default.",
        default: true
    },
    showAdvancedTab: {
        type: OptionType.BOOLEAN,
        description: "Show the Advanced tab with Discord only embed data.",
        default: true
    },
    confirmBeforeDownload: {
        type: OptionType.BOOLEAN,
        description: "Ask for confirmation before downloading files.",
        default: false
    },
    autoCopyAfterExport: {
        type: OptionType.BOOLEAN,
        description: "Copy the exported JSON to the clipboard after downloading it.",
        default: false
    },
    rememberLastTab: {
        type: OptionType.BOOLEAN,
        description: "Reopen Embed Studio on the tab you last used.",
        default: true
    }
}).withPrivateSettings<{ lastTab?: string; }>();
