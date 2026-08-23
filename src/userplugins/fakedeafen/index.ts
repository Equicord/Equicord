import definePlugin from "@utils/types";
import { showToast } from "@webpack/common";

let enabled = false;
let domObserver: MutationObserver | null = null;
let injectTimer: any = null;

var text = new TextDecoder("utf-8");

function updateButtonUI() {
    const btn = document.getElementById("fake-deafen-voice-btn");
    if (!btn) return;
    btn.style.color = enabled ? "#ed4245" : "var(--interactive-normal, #b5bac1)";
    btn.style.opacity = enabled ? "1" : "0.75";
}

function toggle() {
    enabled = !enabled;
    updateButtonUI();
    showToast(`Fake Deafen: ${enabled ? "Enabled" : "Disabled"}`);
}

function injectButton() {
    if (typeof document === "undefined") return;
    if (document.getElementById("fake-deafen-voice-btn")) return;

    const actionRow = document.querySelector(
        'section[class*="panels_"] div[class*="actionButtons_"], section[class*="panels_"] div[class*="buttons_"], section[class*="panels_"] div[class*="container_"] > div:last-child'
    );

    if (!actionRow) return;

    const btn = document.createElement("button");
    btn.id = "fake-deafen-voice-btn";
    btn.type = "button";
    btn.title = "Toggle Fake Deafen";
    btn.setAttribute("aria-label", "Toggle Fake Deafen");
    btn.style.background = "transparent";
    btn.style.border = "none";
    btn.style.cursor = "pointer";
    btn.style.display = "inline-flex";
    btn.style.alignItems = "center";
    btn.style.justifyContent = "center";
    btn.style.padding = "4px";
    btn.style.margin = "0 2px";
    btn.style.borderRadius = "4px";
    btn.style.transition = "color 0.15s ease, opacity 0.15s ease";

    btn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3a9 9 0 0 0-9 9v7a3 3 0 0 0 3 3h1a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2H5v-1a7 7 0 0 1 14 0v1h-2a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h1a3 3 0 0 0 3-3v-7a9 9 0 0 0-9-9zM3.71 2.29a1 1 0 0 0-1.42 1.42l18 18a1 1 0 0 0 1.42-1.42l-18-18z"/>
        </svg>
    `;

    btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle();
    };

    actionRow.prepend(btn);
    updateButtonUI();
}

export default definePlugin({
    name: "FakeDeafen",
    description: "Adds a Fake Deafen button to the voice controls.",
    authors: [{ name: "NashyLove", id: 195516525631897600n }],

    start() {
        WebSocket.prototype.original = WebSocket.prototype.send;
        WebSocket.prototype.send = function (data: any) {
            if (enabled) {
                if (Object.prototype.toString.call(data) === "[object ArrayBuffer]") {
                    if (text.decode(data).includes("self_deaf")) data = data.replace('"self_mute":false', 'NashyLove');
                }
            }
            WebSocket.prototype.original.apply(this, [data]);
        };

        domObserver = new MutationObserver(() => injectButton());
        domObserver.observe(document.body, { childList: true, subtree: true });

        injectTimer = setInterval(injectButton, 1000);
        injectButton();
    },

    stop() {
        if (WebSocket.prototype.original) {
            WebSocket.prototype.send = WebSocket.prototype.original;
            delete WebSocket.prototype.original;
        }

        if (domObserver) {
            domObserver.disconnect();
            domObserver = null;
        }

        if (injectTimer) {
            clearInterval(injectTimer);
            injectTimer = null;
        }

        document.getElementById("fake-deafen-voice-btn")?.remove();
    }
});

declare global {
    interface WebSocket {
        original: any;
    }
}