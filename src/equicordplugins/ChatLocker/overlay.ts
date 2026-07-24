/*
 * ChatLockButton – Overlay management
 */

import { SelectedChannelStore } from "@webpack/common";
import { isLocked } from "./storage";
import { actUnlock, actChange, actRemove } from "./modals";

export function getCurrentId(): string | null {
    return SelectedChannelStore.getChannelId();
}

export let overlayElement: HTMLDivElement | null = null;
export let overlayTimeout: ReturnType<typeof setTimeout> | null = null;
export let overlayRetryInterval: ReturnType<typeof setInterval> | null = null;

export function createOverlay(): HTMLDivElement | null {
    let container = document.querySelector('[class*="messagesWrapper"]') as HTMLElement;
    if (!container) {
        container = document.querySelector('[class*="chatContent"]') as HTMLElement;
    }
    if (!container) {
        console.warn("[ChatLockButton] Chat container not found.");
        return null;
    }

    if (getComputedStyle(container).position === "static") {
        container.style.position = "relative";
    }

    container.style.overflow = "visible";
    container.style.borderRadius = "0";

    removeOverlay();

    const overlay = document.createElement("div");
    overlay.id = "chatlock-overlay";
    overlay.style.cssText = `
        position: absolute;
        inset: -40px;
        z-index: 100;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        background: rgba(0, 0, 0, 0.75);
        backdrop-filter: blur(40px);
        -webkit-backdrop-filter: blur(40px);
        border-radius: 0;
        pointer-events: auto;
        color: var(--text-normal);
        transition: opacity 0.2s;
        will-change: transform;
        box-shadow: 0 0 40px rgba(0, 0, 0, 0.6);
    `;

    const wrapper = document.createElement("div");
    wrapper.className = "lock-content-wrapper";
    wrapper.style.cssText = `
        opacatiy: 075;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        background: rgba(24, 24, 24, 0.85);
        padding: 40px 48px;
        border-radius: 16px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        max-width: 460px;
        width: 90%;
        pointer-events: auto;
    `;

    const icon = document.createElement("div");
    icon.className = "lock-icon";
    icon.style.display = "flex";
    icon.style.alignItems = "center";
    icon.style.justifyContent = "center";
    icon.style.color = "var(--text-muted)";
    icon.innerHTML = `
        <svg width="72" height="72" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fill="currentColor" fill-rule="evenodd" d="M6 9h1V6a5 5 0 0 1 10 0v3h1a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3Zm9-3v3H9V6a3 3 0 1 1 6 0Zm-1 8a2 2 0 0 1-1 1.73V18a1 1 0 1 1-2 0v-2.27A2 2 0 1 1 14 14Z" clip-rule="evenodd"/>
        </svg>
    `;

    const title = document.createElement("div");
    title.className = "lock-title";
    title.textContent = "This chat is locked";
    title.style.cssText = `
        font-size: 20px;
        font-weight: 700;
        color: var(--text-muted);
        text-align: center;
    `;

    const subtitle = document.createElement("div");
    subtitle.className = "lock-subtitle";
    subtitle.textContent = "Enter the password to unlock and view messages.";
    subtitle.style.cssText = `
        font-size: 14px;
        color: var(--text-muted);
        text-align: center;
    `;

    // ---- Main Unlock button ----
    const button = document.createElement("button");
    button.className = "unlock-button";
    button.textContent = "Unlock Chat";
    Object.assign(button.style, {
        marginTop: "4px",
        padding: "12px 28px",
        background: "#5865F2",
        color: "#fff",
        border: "none",
        borderRadius: "8px",
        fontSize: "16px",
        fontWeight: "600",
        fontFamily: '"gg sans", "Noto Sans", "Helvetica Neue", Helvetica, Arial, sans-serif',
        cursor: "pointer",
        transition: "background 0.15s, transform 0.1s",
        pointerEvents: "auto",
        userSelect: "none",
        boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
        width: "100%",
    });
    button.onmouseenter = () => button.style.background = "#4752C4";
    button.onmouseleave = () => button.style.background = "#5865F2";
    button.onmousedown = () => button.style.transform = "scale(0.96)";
    button.onmouseup = () => button.style.transform = "scale(1)";
    button.onclick = () => {
        const id = getCurrentId();
        if (id && isLocked(id)) actUnlock();
    };

    // ---- Change Password button ----
    const changeButton = document.createElement("button");
    changeButton.className = "change-button";
    changeButton.textContent = "Change Password";
    Object.assign(changeButton.style, {
        marginTop: "4px",
        padding: "10px 24px",
        background: "var(--background-secondary)",
        color: "var(--text-normal)",
        border: "none",
        borderRadius: "8px",
        fontSize: "14px",
        fontWeight: "500",
        fontFamily: '"gg sans", "Noto Sans", "Helvetica Neue", Helvetica, Arial, sans-serif',
        cursor: "pointer",
        transition: "background 0.15s, transform 0.1s",
        pointerEvents: "auto",
        userSelect: "none",
        width: "100%",
    });
    changeButton.onmouseenter = () => changeButton.style.background = "var(--background-modifier-hover)";
    changeButton.onmouseleave = () => changeButton.style.background = "var(--background-secondary)";
    changeButton.onmousedown = () => changeButton.style.transform = "scale(0.96)";
    changeButton.onmouseup = () => changeButton.style.transform = "scale(1)";
    changeButton.onclick = () => {
        const id = getCurrentId();
        if (id && isLocked(id)) actChange();
    };

    // ---- Remove Lock button ----
    const removeButton = document.createElement("button");
    removeButton.className = "remove-button";
    removeButton.textContent = "Remove Lock";
    Object.assign(removeButton.style, {
        marginTop: "4px",
        padding: "10px 24px",
        background: "var(--button-danger-background)",
        color: "#fff",
        border: "none",
        borderRadius: "8px",
        fontSize: "14px",
        fontWeight: "500",
        fontFamily: '"gg sans", "Noto Sans", "Helvetica Neue", Helvetica, Arial, sans-serif',
        cursor: "pointer",
        transition: "background 0.15s, transform 0.1s",
        pointerEvents: "auto",
        userSelect: "none",
        width: "100%",
    });
    removeButton.onmouseenter = () => removeButton.style.background = "var(--button-danger-background-hover)";
    removeButton.onmouseleave = () => removeButton.style.background = "var(--button-danger-background)";
    removeButton.onmousedown = () => removeButton.style.transform = "scale(0.96)";
    removeButton.onmouseup = () => removeButton.style.transform = "scale(1)";
    removeButton.onclick = () => {
        const id = getCurrentId();
        if (id && isLocked(id)) actRemove();
    };

    // Append everything
    wrapper.appendChild(icon);
    wrapper.appendChild(title);
    wrapper.appendChild(subtitle);
    wrapper.appendChild(button);
    wrapper.appendChild(changeButton);
    wrapper.appendChild(removeButton);
    overlay.appendChild(wrapper);

    container.appendChild(overlay);
    overlayElement = overlay;
    console.log("[ChatLockButton] Overlay created successfully.");
    return overlay;
}

export function removeOverlay(): void {
    if (overlayElement) {
        overlayElement.remove();
        overlayElement = null;
    }
    document.querySelectorAll("#chatlock-overlay").forEach(el => el.remove());
    if (overlayTimeout) {
        clearTimeout(overlayTimeout);
        overlayTimeout = null;
    }
    if (overlayRetryInterval) {
        clearInterval(overlayRetryInterval);
        overlayRetryInterval = null;
    }
}

export function updateOverlay(): void {
    if (overlayTimeout) {
        clearTimeout(overlayTimeout);
        overlayTimeout = null;
    }

    const id = getCurrentId();
    if (!id) {
        removeOverlay();
        return;
    }

    if (isLocked(id)) {
        if (!overlayElement || !document.body.contains(overlayElement)) {
            const created = createOverlay();
            if (!created) {
                overlayTimeout = setTimeout(() => {
                    updateOverlay();
                }, 500);
            }
        }
    } else {
        removeOverlay();
    }
}

export function startOverlayRetryLoop(): void {
    let attempts = 0;
    const maxAttempts = 20;
    if (overlayRetryInterval) clearInterval(overlayRetryInterval);
    overlayRetryInterval = setInterval(() => {
        attempts++;
        const id = getCurrentId();
        if (id && isLocked(id) && (!overlayElement || !document.body.contains(overlayElement))) {
            const created = createOverlay();
            if (created) {
                clearInterval(overlayRetryInterval);
                overlayRetryInterval = null;
            }
        } else if (attempts >= maxAttempts) {
            clearInterval(overlayRetryInterval);
            overlayRetryInterval = null;
            console.log("[ChatLockButton] Overlay retry loop stopped after 10 seconds.");
        }
    }, 500);
}

export function cleanupOverlay(): void {
    removeOverlay();
    if (overlayTimeout) clearTimeout(overlayTimeout);
    if (overlayRetryInterval) clearInterval(overlayRetryInterval);
}