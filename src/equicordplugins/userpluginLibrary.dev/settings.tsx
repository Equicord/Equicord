/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 nin0
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { OptionType } from "@utils/types";

import { Native } from ".";

export const settings = definePluginSettings({
    allowlistedChannels: {
        type: OptionType.STRING,
        description: "Comma separated list of channels where the Install Plugin button should be displayed. It is always displayed in the Vencord Userplugin channels"
    },
    notifyIfUpdate: {
        type: OptionType.BOOLEAN,
        description: "Show a Vencord notification if UserPlugins need to be updated",
        default: true
    },
    neverNotifyForPlugins: {
        type: OptionType.STRING,
        description: "Never show update notifications for these plugins (you can still update them from the UserPlugins tab)",
        default: ""
    },
    setGitPath: {
        type: OptionType.COMPONENT,
        component: () => <Button onClick={() => {
            Native.openGitPathModal();
        }} variant="secondary">
            Set Git path
        </Button>
    }
});
