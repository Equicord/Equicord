/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Settings } from "@api/Settings";
import { markLocalSettingsDirty, putCloudSettings, shouldCloudSync } from "@api/SettingsSync/cloudSync";
import { debounce } from "@shared/debounce";

// Cloud settings sync already uploads the whole DataStore, but only when settings change, and DataStore
// writes don't count. So mark settings as changed and push shortly after, the same way Vencord.ts does.
const pushToCloud = debounce(() => {
    if (Settings.cloud.settingsSync && Settings.cloud.authenticated && shouldCloudSync("push")) {
        putCloudSettings();
    }
}, 60_000);

export function queueCloudSync() {
    markLocalSettingsDirty();
    pushToCloud();
}
