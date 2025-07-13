/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings, migratePluginSettings } from "@api/Settings";
import { disableStyle, enableStyle } from "@api/Styles";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";

import removeCloseButton from "./removeClose.css?managed";

const settings = definePluginSettings({
    removeCloseButton: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Remove redundant close button, which might actually break plugin if accidentally pressed",
        restartNeeded: true,
    }
});

// By default Discord only seems to only display 'Staging' so we map the names ourself
const names: Record<string, string> = {
    stable: "Stable",
    ptb: "PTB",
    canary: "Canary",
    staging: "Staging"
};

// Useless for the normal User, but useful for me
migratePluginSettings("DiscordDevBanner", "devBanner");

export default definePlugin({
    name: "DiscordDevBanner",
    description: "Enables the Discord developer banner, in which displays the build-ID",
    authors: [ EquicordDevs.KrystalSkull ],

    settings,

    patches: [
        {
            find: ".devBanner,",
            replacement: [{
                match: '"staging"===window.GLOBAL_ENV.RELEASE_CHANNEL',
                replace: "true"
            },
            {
                match: /.\.intl\.format\(.+?,{buildNumber:(.+?)}\)/,
                replace: (_, buildNumber) => `$self.transform(${buildNumber})`
            }]
        }
    ],

    transform(buildNumber: string) {
        const releaseChannel: string = window.GLOBAL_ENV.RELEASE_CHANNEL;

        if (names[releaseChannel]) {
            return `${names[releaseChannel]} ${buildNumber}`;
        } else {
            return `${releaseChannel.charAt(0).toUpperCase() + releaseChannel.slice(1)} ${buildNumber}`;
        }
    },

    start() {
        if (settings.store.removeCloseButton) enableStyle(removeCloseButton);
    },
    stop() {
        if (settings.store.removeCloseButton) disableStyle(removeCloseButton);
    }
});
