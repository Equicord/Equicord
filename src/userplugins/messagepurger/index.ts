import definePlugin from "@utils/types";
import { showToast } from "@webpack/common";
import { findByProps } from "@webpack";

let observer: MutationObserver | null = null;
let pollTimer: any = null;
let isPurging = false;

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function executePurge(count: number) {
    if (isPurging) {
        showToast("Purge is already in progress!");
        return;
    }

    const SelectedChannelStore = findByProps("getChannelId", "getVoiceChannelId");
    const MessageStore = findByProps("getMessages", "getMessage");
    const UserStore = findByProps("getCurrentUser", "getUser");
    const MessageActions = findByProps("deleteMessage", "startEditMessage");

    const channelId = SelectedChannelStore?.getChannelId();
    const currentUser = UserStore?.getCurrentUser();

    if (!channelId || !currentUser || !MessageActions?.deleteMessage) {
        showToast("Error: Discord store modules could not be resolved.");
        return;
    }

    const channelMessages = MessageStore?.getMessages(channelId)?.toArray() || [];
    const myMessages = channelMessages
        .filter((m: any) => m.author?.id === currentUser.id)
        .reverse()
        .slice(0, count);

    if (myMessages.length === 0) {
        showToast("No loaded messages from you were found in this channel.");
        return;
    }

    isPurging = true;
    showToast(`Purging ${myMessages.length} message(s)...`);

    let deleted = 0;
    for (const msg of myMessages) {
        try {
            MessageActions.deleteMessage(channelId, msg.id);
            deleted++;
            await sleep(950); // Safe delay to avoid API rate limiting
        } catch (err) {
            console.error("[MessagePurger] Error deleting message:", err);
            break;
        }
    }

    isPurging = false;
    showToast(`Purge complete: Deleted ${deleted} message(s).`);
}

function openPurgeModal() {
    if (document.getElementById("message-purger-modal")) return;

    const modal = document.createElement("div");
    modal.id = "message-purger-modal";
    modal.style.position = "fixed";
    modal.style.top = "0";
    modal.style.left = "0";
    modal.style.width = "100vw";
    modal.style.height = "100vh";
    modal.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
    modal.style.display = "flex";
    modal.style.alignItems = "center";
    modal.style.justifyContent = "center";
    modal.style.zIndex = "99999";

    const box = document.createElement("div");
    box.style.backgroundColor = "var(--background-secondary, #2f3136)";
    box.style.padding = "20px";
    box.style.borderRadius = "8px";
    box.style.display = "flex";
    box.style.flexDirection = "column";
    box.style.gap = "12px";
    box.style.width = "280px";
    box.style.boxShadow = "0 8px 16px rgba(0,0,0,0.4)";

    box.innerHTML = `
        <div style="color: var(--header-primary, #fff); font-weight: 600; font-size: 16px;">Purge Messages</div>
        <div style="color: var(--text-muted, #b5bac1); font-size: 13px;">How many messages would you like to delete?</div>
        <input id="purge-count-input" type="number" value="10" min="1" max="100" style="
            background: var(--input-background, #202225);
            border: 1px solid var(--background-tertiary, #202225);
            border-radius: 4px;
            color: #fff;
            padding: 8px;
            font-size: 14px;
            outline: none;
        "/>
        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px;">
            <button id="purge-cancel-btn" style="
                background: transparent;
                border: none;
                color: var(--text-normal, #fff);
                padding: 6px 14px;
                cursor: pointer;
                border-radius: 4px;
            ">Cancel</button>
            <button id="purge-confirm-btn" style="
                background: #ed4245;
                border: none;
                color: #fff;
                padding: 6px 14px;
                cursor: pointer;
                font-weight: 500;
                border-radius: 4px;
            ">Delete</button>
        </div>
    `;

    modal.appendChild(box);
    document.body.appendChild(modal);

    const input = box.querySelector("#purge-count-input") as HTMLInputElement;
    input?.focus();
    input?.select();

    const cleanup = () => modal.remove();

    box.querySelector("#purge-cancel-btn")?.addEventListener("click", cleanup);
    modal.addEventListener("click", (e) => {
        if (e.target === modal) cleanup();
    });

    box.querySelector("#purge-confirm-btn")?.addEventListener("click", () => {
        const val = parseInt(input.value, 10);
        cleanup();
        if (!isNaN(val) && val > 0) {
            executePurge(val);
        } else {
            showToast("Invalid number entered.");
        }
    });

    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            const val = parseInt(input.value, 10);
            cleanup();
            if (!isNaN(val) && val > 0) {
                executePurge(val);
            }
        } else if (e.key === "Escape") {
            cleanup();
        }
    });
}

function injectPurgeButton() {
    if (typeof document === "undefined") return;
    if (document.getElementById("message-purge-btn")) return;

    const chatBar = document.querySelector(
        'div[class*="buttons_"][class*="channelTextArea_"], div[class*="inner_"] > div[class*="buttons_"], div[class*="channelAppLauncher_"]'
    );
    if (!chatBar) return;

    const btn = document.createElement("button");
    btn.id = "message-purge-btn";
    btn.type = "button";
    btn.title = "Bulk Delete Messages";
    btn.setAttribute("aria-label", "Bulk Delete Messages");
    btn.style.background = "transparent";
    btn.style.border = "none";
    btn.style.cursor = "pointer";
    btn.style.display = "inline-flex";
    btn.style.alignItems = "center";
    btn.style.justifyContent = "center";
    btn.style.padding = "4px";
    btn.style.margin = "0 2px";
    btn.style.color = "var(--interactive-normal, #b5bac1)";
    btn.style.pointerEvents = "auto";
    btn.style.zIndex = "10";
    btn.style.transition = "color 0.15s ease";

    btn.innerHTML = `
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" style="pointer-events: none;">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
        </svg>
    `;

    btn.onmouseenter = () => (btn.style.color = "#ed4245");
    btn.onmouseleave = () => (btn.style.color = "var(--interactive-normal, #b5bac1)");

    btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openPurgeModal();
    }, true);

    chatBar.prepend(btn);
}

export default definePlugin({
    name: "MessagePurger",
    description: "Adds a clickable trash bin button to the chat bar to delete recent messages via modal.",
    authors: [{ name: "NashyLove", id: 195516525631897600n }],

    start() {
        observer = new MutationObserver(() => injectPurgeButton());
        observer.observe(document.body, { childList: true, subtree: true });

        pollTimer = setInterval(injectPurgeButton, 1000);
        injectPurgeButton();
    },

    stop() {
        if (observer) {
            observer.disconnect();
            observer = null;
        }
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
        document.getElementById("message-purge-btn")?.remove();
        document.getElementById("message-purger-modal")?.remove();
    }
});