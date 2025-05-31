/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { findByPropsLazy } from "@webpack";


// who ever reads this i did this code while on a fuck load of iced coffee and no fucking sleep sorry :/ its really shit
const connectedAccountClasses = findByPropsLazy("connectedAccount");

export default definePlugin({
    name: "MoreConnectionButtons",
    description: "Adds buttons to connections that don't normally have it.",
    authors: [EquicordDevs.interia],

    start() {
        this.addOpenButtons();
        this.observer = new MutationObserver(() => {
            this.addOpenButtons();
        });
        this.observer.observe(document.body, { childList: true, subtree: true });
    },

    stop() {
        if (this.observer) {
            this.observer.disconnect();
        }
        document.querySelectorAll(".xbox-open-button").forEach(btn => btn.remove());
    },

    addOpenButtons() {
        const containers = document.querySelectorAll([
            ".connectedAccount_e6abe8",
            "[class*='connectedAccount']",
            "section div[class*='connection']",
            "div[class*='profileSection'] div[class*='connection']",
            ".connectedAccountNameTextContainer_e6abe8"
        ].join(", "));


        document.querySelectorAll(".connectedAccounts_fcb628 .xbox-open-button, [class*='connectedAccounts'] .xbox-open-button").forEach(btn => {
            const container = btn.closest("[class*='connectedAccount'], [class*='connection']");
            if (container) {
                const buttons = container.querySelectorAll(".xbox-open-button");
                if (buttons.length > 1) {
                    for (let i = 1; i < buttons.length; i++) {
                        buttons[i].remove();
                    }
                }
            }
        });

        containers.forEach(container => {
            if (container.querySelector(".xbox-open-button")) return;
            const hasXbox = container.querySelector("img[src*='xbox']") ||
                container.querySelector("img[alt*='Xbox']") ||
                container.querySelector("[aria-label*='Xbox']") ||
                container.textContent?.toLowerCase().includes("xbox") ||
                container.innerHTML?.toLowerCase().includes("xbox");

            if (!hasXbox) return;

            let username: string | null = null;
            const nameSelectors = [
                ".connectedAccountNameText_e6abe8",
                "[class*='connectedAccountNameText']",
                "[class*='nameText']",
                ".text-sm\\/medium_cf4812",
                "div[class*='text'] span",
                "div > span",
                "[class*='username']",
                "[class*='displayName']"
            ];

            for (const selector of nameSelectors) {
                const nameElement = container.querySelector(selector);
                if (nameElement) {
                    const text = nameElement.textContent?.trim();
                    const ariaLabel = nameElement.getAttribute("aria-label");
                    username = text || ariaLabel;
                    if (username && username !== "Xbox" && !username.toLowerCase().includes("connected")) break;
                }
            }

            if (!username) return;

            if (document.querySelector(`.xbox-open-button[aria-label="Open Xbox profile for ${username}"]`)) return;

            this.createOpenButton(container, username);
        });
    },

    createOpenButton(container: Element, username: string) {
        const button = document.createElement("button");
        button.className = "xbox-open-button";
        const existingButton = container.querySelector(".xbox-open-button");
        if (existingButton) existingButton.remove();

        button.innerHTML = `
            <svg aria-hidden="true" role="img" width="16" height="16" class="xbox-open-icon" viewBox="0 0 16 16" fill="none">
            <path d="M5 11L11 5" stroke="#CCCCCC" stroke-width="1"/>
            <path d="M6 5H11V10" stroke="#CCCCCC" stroke-width="1"/>
            </svg>
        `;

        button.title = `Open Xbox profile for ${username}`;
        button.setAttribute("aria-label", `Open Xbox profile for ${username}`);

        button.addEventListener("click", e => {
            e.preventDefault();
            e.stopPropagation();
            const url = `https://www.xbox.com/en-US/play/user/${encodeURIComponent(username)}`;
            window.open(url, "_blank", "noopener,noreferrer");
        });
        if (container instanceof HTMLElement) {
            container.style.position = "relative";
        }
        container.appendChild(button);
    }
});

