/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs, EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { findComponentByCodeLazy, findStoreLazy } from "@webpack";
import { TypingStore, UserStore, useStateFromStores } from "@webpack/common";

const ThreeDots = findComponentByCodeLazy("Math.min(1,Math.max(", "dotRadius:");

const PrivateChannelSortStore = findStoreLazy("PrivateChannelSortStore") as {
    getPrivateChannelIds: () => string[];
};

export default definePlugin({
    name: "HomeTyping",
    description: "Changes the home button to a typing indicator if someone in your dms is typing.",
    authors: [Devs.Samwich, EquicordDevs.playfairs],

    TypingIcon() {
        return <ThreeDots dotRadius={3} themed={true} />;
    },
    updateHomeButtonClass(isTyping: boolean) {
        const homeButton = document.querySelector('[data-list-item-id="guildsnav___home"]');
        if (homeButton) {
            if (isTyping) {
                homeButton.classList.add("vc-home-typing");
            } else {
                homeButton.classList.remove("vc-home-typing");
            }
        }
    },
    isTyping() {
        return useStateFromStores([TypingStore], () =>
            PrivateChannelSortStore.getPrivateChannelIds().some(id =>
                Object.keys(TypingStore.getTypingUsers(id)).some(
                    userId => userId !== UserStore.getCurrentUser().id
                )
            )
        );
    },

    patches: [
        {
            find: "#{intl::DISCODO_DISABLED}",
            replacement: [
                {
                    match: /(\(0,\i.jsx\)\(\i.\i,{}\))/,
                    replace: "arguments[0].user == null ? null : ($self.updateHomeButtonClass(vcIsTyping), vcIsTyping ? $self.TypingIcon() : $1)"
                },
                {
                    match: /if\(null==\i\)return null;/,
                    replace: "let vcIsTyping = $self.isTyping();$&"
                }
            ],
            group: true
        }
    ]
});
