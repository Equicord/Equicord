import "./styles.css";

import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { Channel, Guild } from "discord-types/general";
import { ChannelStore, SelectedGuildStore } from "@webpack/common";
import { getCurrentGuild } from "@utils/discord";
import { isEnabled, returnChannelBadge, settings } from "./settings";

let observer: MutationObserver | null = null;
let currentGuild: Guild | undefined | null = null;

function addBadgesToChannel(element: HTMLElement, channelId: string) {
    const parentContainer: HTMLElement | null = element.querySelector('[class*="linkTop"]');

    if (parentContainer) {
        const channel: Channel | undefined = ChannelStore.getChannel(channelId);
        if (!channel) return;

        const { type, nsfw, threadMetadata } = channel;
        const isEnabledBoolean: boolean = isEnabled(type);

        if (!isEnabledBoolean) return;

        const isRules: boolean = currentGuild?.rulesChannelId === channel.id;
        const isPrivate: boolean = channel.isPrivate() || threadMetadata?.locked || channel.isArchivedThread();
        const isNSFW: boolean = nsfw || channel.isNSFW();

        let badgeContainer: HTMLElement | null = parentContainer.querySelector(".badge-container");
        if (!badgeContainer) {
            badgeContainer = document.createElement("div");
            badgeContainer.classList.add("badge-container");
            parentContainer.appendChild(badgeContainer);
        }

        if (isPrivate && isEnabled(6101)) {
            const { css, label } = returnChannelBadge(6101);
            const privateBadge = document.createElement("div");
            privateBadge.classList.add("channel-badge", `channel-badge-${css}`);
            privateBadge.textContent = label;
            privateBadge.title = "This channel is locked.";
            badgeContainer.appendChild(privateBadge);
        }

        if (isNSFW && isEnabled(6100)) {
            const { css, label } = returnChannelBadge(6100);
            const nsfwBadge = document.createElement("div");
            nsfwBadge.classList.add("channel-badge", `channel-badge-${css}`);
            nsfwBadge.textContent = label;
            nsfwBadge.title = "This channel is marked as NSFW.";
            badgeContainer.appendChild(nsfwBadge);
        }

        if (isRules && isEnabled(6102)) {
            const { css, label } = returnChannelBadge(6102);
            const rulesBadge = document.createElement("div");
            rulesBadge.classList.add("channel-badge", `channel-badge-${css}`);
            rulesBadge.textContent = label;
            rulesBadge.title = "This channel is the rules channel.";
            badgeContainer.appendChild(rulesBadge);
        }

        const { css, label } = returnChannelBadge(type);
        const typeBadge = document.createElement("div");
        typeBadge.classList.add("channel-badge", `channel-badge-${css}`);
        typeBadge.textContent = label;
        typeBadge.title = label;
        badgeContainer.appendChild(typeBadge);
    }
}

function deleteAllBadges() {
    document.querySelectorAll(".channel-badge").forEach(badge => badge.remove());

    document.querySelectorAll('[data-list-item-id^="channels___"][data-scanned]').forEach(element => {
        element.removeAttribute("data-scanned");
    });
}

export function reloadBadges() {
    deleteAllBadges();

    document.querySelectorAll('[data-list-item-id^="channels___"]').forEach(element => {
        const channelId = element.getAttribute("data-list-item-id")?.split("___")[1];
        if (channelId && /^\d+$/.test(channelId)) {
            addBadgesToChannel(element as HTMLElement, channelId);
            element.setAttribute("data-scanned", "true");
        }
    });
}

function observeDomChanges() {
    if (observer) observer.disconnect();

    observer = new MutationObserver(mutations => {
        const addedElements: Set<Element> = new Set();

        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    const element = node;
                    if (element instanceof Element) {
                        element.querySelectorAll('[data-list-item-id^="channels___"]:not([data-scanned])').forEach(child => {
                            addedElements.add(child);
                        });
                    }
                }
            });
        });

        addedElements.forEach(element => {
            const channelId = element.getAttribute("data-list-item-id")?.split("___")[1];
            if (channelId && /^\d+$/.test(channelId)) {
                addBadgesToChannel(element as HTMLElement, channelId);
                element.setAttribute("data-scanned", "true");
            }
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

function onGuildChange() {
    const newGuild: Guild | undefined | null = getCurrentGuild();
    if (newGuild !== currentGuild) {
        currentGuild = newGuild;
        console.log(newGuild);
    }
}

export default definePlugin({
    name: "ChannelBadges",
    description: "Adds badges to channels based on their type",
    authors: [EquicordDevs.creations],
    settings,

    async start() {
        currentGuild = getCurrentGuild();
        observeDomChanges();
        reloadBadges();
        SelectedGuildStore.addChangeListener(onGuildChange);
    },

    stop() {
        if (observer) observer.disconnect();
        deleteAllBadges();
        SelectedGuildStore.removeChangeListener(onGuildChange);
    },
});
