/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { showToast, Toasts } from "@webpack/common";

const settings = definePluginSettings({
    keybind: {
        type: OptionType.STRING,
        description: "Keybind to open message ID input (e.g., 'mod+o' for Cmd+O on Mac, Ctrl+O on Windows)",
        default: "mod+o"
    },
    buttonIndex: {
        type: OptionType.NUMBER,
        description: "Which button to click (0 = first button, 1 = second button, etc.)",
        default: 0
    },
    clickDelay: {
        type: OptionType.NUMBER,
        description: "Delay between clicks in milliseconds",
        default: 100
    }
});

let messageIdInput: HTMLInputElement | null = null;
let clickInterval: NodeJS.Timeout | null = null;
let isSpamming = false;
let currentMessageId: string | null = null;

function createMessageIdModal() {
    const existingModal = document.getElementById("message-id-modal");
    if (existingModal) existingModal.remove();

    const overlay = document.createElement("div");
    overlay.id = "message-id-modal";
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.85);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
    `;

    const modal = document.createElement("div");
    modal.style.cssText = `
        background: #2f3136;
        border-radius: 8px;
        padding: 20px;
        min-width: 400px;
        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.4);
    `;

    const title = document.createElement("h2");
    title.textContent = isSpamming ? "Auto Clicker Active" : "Enter Message ID";
    title.style.cssText = `
        color: #ffffff;
        margin: 0 0 15px 0;
        font-size: 20px;
        font-weight: 600;
    `;

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Paste message ID here...";
    input.value = currentMessageId || "";
    input.disabled = isSpamming;
    input.style.cssText = `
        width: 100%;
        padding: 10px;
        background: ${isSpamming ? "#18191c" : "#202225"};
        border: 1px solid #202225;
        border-radius: 4px;
        color: #dcddde;
        font-size: 16px;
        box-sizing: border-box;
        margin-bottom: 10px;
        ${isSpamming ? "cursor: not-allowed; opacity: 0.6;" : ""}
    `;

    const statusText = document.createElement("p");
    statusText.style.cssText = `
        color: ${isSpamming ? "#57f287" : "#b9bbbe"};
        margin: 0 0 15px 0;
        font-size: 14px;
    `;
    statusText.textContent = isSpamming
        ? `🔄 Auto-clicking button ${settings.store.buttonIndex} every ${settings.store.clickDelay}ms...`
        : "Enter message ID and click Start to begin auto-clicking";

    const buttonContainer = document.createElement("div");
    buttonContainer.style.cssText = `
        display: flex;
        gap: 10px;
        justify-content: flex-end;
    `;

    const closeModal = () => {
        overlay.remove();
        messageIdInput = null;
    };

    if (isSpamming) {
        const stopButton = document.createElement("button");
        stopButton.textContent = "Stop";
        stopButton.style.cssText = `
            padding: 10px 20px;
            background: #ed4245;
            border: none;
            border-radius: 4px;
            color: white;
            font-weight: 500;
            cursor: pointer;
            font-size: 14px;
        `;

        stopButton.addEventListener("click", () => {
            stopSpamClicking();
            closeModal();
        });

        buttonContainer.appendChild(stopButton);
    } else {
        const submitButton = document.createElement("button");
        submitButton.textContent = "Start";
        submitButton.style.cssText = `
            padding: 10px 20px;
            background: #57f287;
            border: none;
            border-radius: 4px;
            color: #000000;
            font-weight: 500;
            cursor: pointer;
            font-size: 14px;
        `;

        const cancelButton = document.createElement("button");
        cancelButton.textContent = "Cancel";
        cancelButton.style.cssText = `
            padding: 10px 20px;
            background: #4f545c;
            border: none;
            border-radius: 4px;
            color: white;
            font-weight: 500;
            cursor: pointer;
            font-size: 14px;
        `;

        submitButton.addEventListener("click", async () => {
            const messageId = input.value.trim();
            if (messageId) {
                startSpamClicking(messageId);
                closeModal();
            }
        });

        cancelButton.addEventListener("click", closeModal);

        input.addEventListener("keydown", async (e: KeyboardEvent) => {
            if (e.key === "Enter") {
                const messageId = input.value.trim();
                if (messageId) {
                    startSpamClicking(messageId);
                    closeModal();
                }
            } else if (e.key === "Escape") {
                closeModal();
            }
        });

        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(submitButton);
    }

    overlay.addEventListener("click", (e: MouseEvent) => {
        if (e.target === overlay) closeModal();
    });

    modal.appendChild(title);
    modal.appendChild(input);
    modal.appendChild(statusText);
    modal.appendChild(buttonContainer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    messageIdInput = input;
    if (!isSpamming) {
        setTimeout(() => input.focus(), 0);
    }
}

function startSpamClicking(messageId: string) {
    if (isSpamming) {
        showToast("Already auto-clicking! Press Cmd+O to stop.", Toasts.Type.FAILURE);
        return;
    }

    currentMessageId = messageId;
    isSpamming = true;

    clickMessageButton(messageId);

    clickInterval = setInterval(() => {
        clickMessageButton(messageId);
    }, settings.store.clickDelay);

    showToast("Started auto-clicking! Press Cmd+O to stop.", Toasts.Type.SUCCESS);
}

function stopSpamClicking() {
    if (clickInterval) {
        clearInterval(clickInterval);
        clickInterval = null;
    }
    isSpamming = false;
    showToast("Auto-clicking stopped.", Toasts.Type.SUCCESS);
}

async function clickMessageButton(messageId: string) {
    try {
        const messageElement = document.querySelector(`[id^="chat-messages-"][id$="${messageId}"]`);

        if (!messageElement) {
            if (isSpamming) {
                stopSpamClicking();
                showToast("Message not found. Auto-clicking stopped.", Toasts.Type.FAILURE);
            } else {
                showToast("Message not found. Make sure the message is visible in the current channel.", Toasts.Type.FAILURE);
            }
            return;
        }

        const buttons = messageElement.querySelectorAll('button[class*="button"]');

        if (buttons.length === 0) {
            if (isSpamming) {
                stopSpamClicking();
                showToast("No buttons found. Auto-clicking stopped.", Toasts.Type.FAILURE);
            } else {
                showToast("No buttons found on this message.", Toasts.Type.FAILURE);
            }
            return;
        }

        const targetButton = buttons[settings.store.buttonIndex] as HTMLButtonElement || buttons[0] as HTMLButtonElement;

        const reactKey = Object.keys(targetButton).find(key => key.startsWith("__reactProps"));

        if (reactKey && targetButton[reactKey]?.onClick) {
            targetButton[reactKey].onClick({ preventDefault: () => {}, stopPropagation: () => {} });
            if (!isSpamming) {
                showToast(`Successfully clicked button on message ${messageId}`, Toasts.Type.SUCCESS);
            }
        } else {
            targetButton.click();
            if (!isSpamming) {
                showToast(`Clicked button on message ${messageId}`, Toasts.Type.SUCCESS);
            }
        }

    } catch (error: any) {
        console.error("Error clicking message button:", error);
        showToast(`Error: ${error.message}`, Toasts.Type.FAILURE);
    }
}

function handleKeyPress(e: KeyboardEvent) {
    const keybind = settings.store.keybind.toLowerCase();
    const parts = keybind.split("+");

    const needsMod = parts.includes("mod");
    const needsCtrl = parts.includes("ctrl");
    const needsShift = parts.includes("shift");
    const needsAlt = parts.includes("alt");
    const key = parts[parts.length - 1];

    const modPressed = navigator.platform.includes("Mac") ? e.metaKey : e.ctrlKey;

    const matches =
        (needsMod ? modPressed : true) &&
        (needsCtrl ? e.ctrlKey : true) &&
        (needsShift ? e.shiftKey : true) &&
        (needsAlt ? e.altKey : true) &&
        e.key.toLowerCase() === key;

    if (matches) {
        e.preventDefault();
        e.stopPropagation();
        createMessageIdModal();
    }
}

export default definePlugin({
    name: "AutoButtonClicker",
    description: "Input a message ID via keybind and automatically click buttons on that message",
    authors: [Devs.rz30],
    settings,

    start() {
        document.addEventListener("keydown", handleKeyPress, true);
    },

    stop() {
        document.removeEventListener("keydown", handleKeyPress, true);
        stopSpamClicking();
        const modal = document.getElementById("message-id-modal");
        if (modal) modal.remove();
    }
});
