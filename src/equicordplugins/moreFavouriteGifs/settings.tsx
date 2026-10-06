/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { OptionType } from "@utils/types";

import { exportBackup, importBackup } from "./backup";

export const settings = definePluginSettings({
    showPopup: {
        type: OptionType.BOOLEAN,
        description: "Show a popup when a GIF is saved locally because Discord's limit was reached",
        default: true
    },
    cloudSync: {
        type: OptionType.BOOLEAN,
        description: "Include your local favourites in Equicord Cloud settings sync (needs settings sync enabled in Cloud settings)",
        default: true
    },
    exportBackup: {
        type: OptionType.COMPONENT,
        description: "Save your local favourites to a file.",
        component: () => <Button onClick={exportBackup}>Export Backup</Button>
    },
    importBackup: {
        type: OptionType.COMPONENT,
        description: "Restore local favourites from a backup file. GIFs you already have are kept.",
        component: () => <Button onClick={importBackup}>Import Backup</Button>
    }
});
