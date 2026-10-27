/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import definePlugin, { OptionType } from "@utils/types";
import { findComponentByCodeLazy } from "@webpack";
import { PrivateChannelSortStore, TypingStore, UserGuildSettingsStore, UserStore, useStateFromStores } from "@webpack/common";

const cl = classNameFactory("vc-home-typing-");

const ThreeDots = findComponentByCodeLazy("Math.min(1,Math.max(", "dotRadius:");

const settings = definePluginSettings({
    ignoreMutedChannels: {
        type: OptionType.BOOLEAN,
        description: "Hide the home typing indicator for muted DMs and group DMs.",
        default: true
    }
});
const settingsKeys: Array<keyof typeof settings.store> = ["ignoreMutedChannels"];

export default definePlugin({
    name: "HomeTyping",
    description: "Changes the home button to a typing indicator if someone in your dms is typing",
    tags: ["Chat"],
    authors: [Devs.Samwich],
    settings,
    TypingIcon() {
        return <ThreeDots className={cl("dots")} dotRadius={3} themed={true} />;
    },
    isTyping() {
        const { ignoreMutedChannels } = settings.use(settingsKeys);
        return useStateFromStores([TypingStore, PrivateChannelSortStore, UserGuildSettingsStore, UserStore], () =>
            PrivateChannelSortStore.getPrivateChannelIds().some(id =>
                (!ignoreMutedChannels || !UserGuildSettingsStore.isChannelMuted(null, id))
                && Object.keys(TypingStore.getTypingUsers(id)).some(userId => userId !== UserStore.getCurrentUser().id)
            ), [ignoreMutedChannels]
        );
    },
    patches: [
        {
            find: "#{intl::DISCODO_DISABLED}",
            replacement:
                [
                    {
                        match: /(?<=BUTTON_HOME.{0,10}children:)(\(0,\i.jsxs?\)\(\i,{}\))/,
                        replace: "arguments[0].user == null ? null : (vcIsTyping ? $self.TypingIcon() : $1)"
                    },
                    // define isTyping earlier in the function so i dont bReAk ThE rUlEs Of HoOkS
                    {
                        match: /if\(null==\i\)return null;/,
                        replace: "let vcIsTyping = $self.isTyping();$&"
                    }
                ],
            group: true
        }
    ]
});
