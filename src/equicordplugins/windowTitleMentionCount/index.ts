/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { Callback } from "@vencord/discord-types";
import { findStoreLazy } from "@webpack";
import { RelationshipStore } from "@webpack/common";

const GuildReadStateStore = findStoreLazy("GuildReadStateStore") as {
    getTotalMentionCount(): number;
    addChangeListener(callback: Callback): void;
    removeChangeListener(callback: Callback): void;
};

const MessageRequestStore = findStoreLazy("MessageRequestStore") as {
    getMessageRequestsCount(): number;
    addChangeListener(callback: Callback): void;
    removeChangeListener(callback: Callback): void;
};

const settings = definePluginSettings({
    includeFriendRequests: {
        type: OptionType.BOOLEAN,
        description: "Includes friend requests in the count",
        default: true,
        onChange: refreshTitle
    },
    includeMessageRequests: {
        type: OptionType.BOOLEAN,
        description: "Includes message requests in the count",
        default: true,
        onChange: refreshTitle
    }
});

function getPrefix() {
    let count: number = GuildReadStateStore.getTotalMentionCount();

    if (settings.store.includeFriendRequests) {
        count += RelationshipStore.getPendingCount();
    }

    if (settings.store.includeMessageRequests) {
        count += MessageRequestStore.getMessageRequestsCount();
    }

    return count > 0 ? `(${count}) ` : "";
}

function refreshTitle() {
    if (document.title) {
        document.title = document.title;
    }
}

export default definePlugin({
    name: "WindowTitleMentionCount",
    description: "Adds the mention count as a prefix to the window title. Useful for setups where the mention badge isn't visible.",
    authors: [EquicordDevs.Nekro],
    tags: ["Notifications", "Appearance"],
    hidden: !IS_DISCORD_DESKTOP,
    settings,

    start() {
        const titleDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, "title");
        if (!titleDescriptor?.set) return;

        Object.defineProperty(document, "title", {
            configurable: true,
            enumerable: true,
            set(value: string) {
                titleDescriptor.set!.call(document, getPrefix() + value.replace(/^\(\d+\) /, ""));
            },
            get: titleDescriptor.get
        });

        GuildReadStateStore.addChangeListener(refreshTitle);
        RelationshipStore.addChangeListener(refreshTitle);
        MessageRequestStore.addChangeListener(refreshTitle);

        refreshTitle();
    },

    stop() {
        GuildReadStateStore.removeChangeListener(refreshTitle);
        RelationshipStore.removeChangeListener(refreshTitle);
        MessageRequestStore.removeChangeListener(refreshTitle);

        delete (document as any).title;
        document.title = document.title.replace(/^\(\d+\) /, "");
    },
});
