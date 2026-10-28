/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Will James
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType, PluginNative } from "@utils/types";
import { findByPropsLazy } from "@webpack";

const AudioActions = findByPropsLazy("toggleSelfMute");
const Native = VencordNative.pluginHelpers.GlobalMute as PluginNative<typeof import("./native")>;

const settings = definePluginSettings({
    hotkey: {
        type: OptionType.STRING,
        description: "Electron accelerator, e.g. Control+Shift+M ; https://www.electronjs.org/docs/latest/tutorial/keyboard-shortcuts",
        default: "Control+Alt+Shift+M",
        restartNeeded: true
    }
});

export default definePlugin({
    name: "GlobalMute",
    description: "System wide hotkey that toggles Discord mute",
    authors: [EquicordDevs.willjms],
    settings,

    toggle() {
        AudioActions.toggleSelfMute();
    },

    async start() {
        const ok = await Native.register(settings.store.hotkey);
        if (!ok) console.warn("[GlobalMute] couldn't register", settings.store.hotkey);
    },

    stop() {
        Native.unregister();
    }
});
