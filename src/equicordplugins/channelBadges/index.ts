/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { getCurrentGuild } from "@utils/discord";
import { SelectedGuildStore, ChannelStore } from "@webpack/common";

import { settings } from "./settings";

let observer: MutationObserver | null = null;

const channelTypes = {
    0: "Text Channel",
    1: "DM",
    2: "Voice Channel",
    3: "Group DM",
    4: "Category",
    5: "Announcement Channel",
    10: "Announcement Thread",
    11: "Public Thread",
    12: "Private Thread",
    13: "Stage Channel",
    14: "Directory Channel",
    15: "Forum Channel"
};

const channelCategories = {
    0: "Text",
    1: "DM",
    2: "Voice",
    3: "DM",
    4: "Category",
    5: "Announcement",
    10: "Thread",
    11: "Thread",
    12: "Thread",
    13: "Stage",
    14: "Directory",
    15: "Forum"
};

function createBadge(label: string, className: string): HTMLElement {
    const badge = document.createElement("span");
    badge.classList.add(className);
    badge.classList.add("badge");
    badge.textContent = label;
    return badge;
}

function addBadgesToChannel(element: Element, category: string, nsfw: boolean, locked: boolean) {
    const parentContainer = element.querySelector('[class*="linkTop"]');

    if (parentContainer) {
        const oldBadges = parentContainer.querySelectorAll(".badge");
        oldBadges.forEach(badge => badge.remove());

        if (nsfw) {
            parentContainer.appendChild(createBadge("NSFW", "nsfw-badge"));
        }

        if (locked) {
            parentContainer.appendChild(createBadge("LOCKED", "locked-badge"));
        }

        parentContainer.appendChild(createBadge(category, `${category.toLowerCase()}-badge`));
    }
}

function categorizeChannels(channelId: string) {
    const channel = ChannelStore.getChannel(channelId);
    if (!channel) return { category: "Unknown", nsfw: false, locked: false };

    const category = channelCategories[channel.type] || "Unknown";
    const nsfw = channel.nsfw || channel.isNSFW();
    const locked = channel.threadMetadata?.locked || channel.isPrivate();

    return { category, nsfw, locked };
}

function observeDomChanges() {
    if (observer) {
        observer.disconnect();
    }

    observer = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
            if (mutation.addedNodes.length > 0) {
                const textChannels = document.querySelectorAll('[data-list-item-id^="channels___"]:not([data-scanned])');

                textChannels.forEach((element: Element) => {
                    const channelId = element.getAttribute("data-list-item-id")?.split("___")[1];

                    if (channelId && /^\d+$/.test(channelId)) {
                        const { category, nsfw, locked } = categorizeChannels(channelId);
                        addBadgesToChannel(element, category, nsfw, locked);

                        element.setAttribute("data-scanned", "true");
                    }
                });
            }
        }
    });

    const targetNode = document.body;
    observer.observe(targetNode, { childList: true, subtree: true });
}

function onGuildSwitch() {
    const guild = getCurrentGuild();
    if (!guild) return;

    console.log(`Switched to guild: ${guild.name}`);
    observeDomChanges();
}

export default definePlugin({
    name: "ChannelBadges",
    description: "Adds badges to channels based on their type",
    authors: [EquicordDevs.creations],
    settings: settings,

    async start() {
        observeDomChanges();
        SelectedGuildStore.addChangeListener(onGuildSwitch);
    },

    stop() {
        if (observer) {
            observer.disconnect();
            observer = null;
        }
        SelectedGuildStore.removeChangeListener(onGuildSwitch);
    }
});
