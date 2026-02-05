
import definePlugin from "@utils/types";
import { FluxDispatcher, MediaEngineStore } from "@webpack/common";

const INPUT_MODE_PTT = "PUSH_TO_TALK";
const INPUT_MODE_VAD = "VOICE_ACTIVITY";

function getInputMode(): string {
    try {
        const state = (MediaEngineStore as any).getState?.();
        return state?.settingsByContext?.default?.mode || INPUT_MODE_VAD;
    } catch {
        return INPUT_MODE_VAD;
    }
}

function toggleInputMode() {
    const currentMode = getInputMode();
    const newMode = currentMode === INPUT_MODE_PTT ? INPUT_MODE_VAD : INPUT_MODE_PTT;
    const state = (MediaEngineStore as any).getState?.() || {};

    FluxDispatcher.dispatch({
        type: "AUDIO_SET_MODE",
        context: "default",
        mode: newMode,
        options: state?.settingsByContext?.default?.modeOptions || {}
    });
}

function createCheckboxIcon(isChecked: boolean): SVGElement {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "c1e9c47c23f12ca3-icon");
    svg.setAttribute("width", "20");
    svg.setAttribute("height", "20");
    svg.setAttribute("viewBox", "0 0 20 20");
    svg.setAttribute("fill", "none");
    svg.style.color = "var(--interactive-normal)";

    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", "4");
    rect.setAttribute("y", "4");
    rect.setAttribute("width", "12");
    rect.setAttribute("height", "12");
    rect.setAttribute("rx", "2");
    rect.setAttribute("stroke", "currentColor");
    rect.setAttribute("stroke-width", "1.5");
    rect.setAttribute("fill", isChecked ? "var(--brand-500)" : "transparent");
    svg.appendChild(rect);

    if (isChecked) {
        const checkmark = document.createElementNS("http://www.w3.org/2000/svg", "path");
        checkmark.setAttribute("d", "M6.5 10L9 12.5L13.5 8");
        checkmark.setAttribute("stroke", "#FFFFFF");
        checkmark.setAttribute("stroke-width", "2");
        checkmark.setAttribute("stroke-linecap", "round");
        checkmark.setAttribute("stroke-linejoin", "round");
        checkmark.setAttribute("fill", "none");
        svg.appendChild(checkmark);
    }

    return svg;
}

export default definePlugin({
    name: "PushToTalkToggle",
    description: "Adds a push-to-talk toggle checkbox to the microphone button context menu next to Input Profile",
    authors: [{ name: "Bluscream", id: 331103316650393611n }, { name: "Antigravity AI", id: 0n }],

    start() {
        const observer = new MutationObserver(() => {
            const menu = document.querySelector("#audio-device-context");
            if (!menu || menu.querySelector("#audio-device-context-ptt-toggle")) return;

            const inputProfileItem = menu.querySelector("#audio-device-context-input-profiles");
            if (!inputProfileItem) return;

            let parent: HTMLElement | null = inputProfileItem.parentElement;
            while (parent && !parent.hasAttribute("role")) {
                parent = parent.parentElement;
            }
            if (!parent) parent = (menu.querySelector("[role='menu'] > div[class*='scroller']") || menu) as HTMLElement;

            let inputProfileContainer = inputProfileItem.parentElement;
            while (inputProfileContainer && inputProfileContainer.tagName !== "DIV") {
                inputProfileContainer = inputProfileContainer.parentElement;
            }
            if (!inputProfileContainer) return;

            const toggleContainer = inputProfileContainer.cloneNode(true) as HTMLElement;
            toggleContainer.id = "audio-device-context-ptt-toggle";
            toggleContainer.setAttribute("role", "menuitemcheckbox");
            toggleContainer.setAttribute("tabindex", "-1");
            toggleContainer.setAttribute("data-menu-item", "true");

            // Remove any duplicate IDs from nested children to avoid ID conflicts
            const nestedItemsWithId = toggleContainer.querySelectorAll("[id^='audio-device-context']");
            nestedItemsWithId.forEach(item => {
                if (item.id !== "audio-device-context-ptt-toggle") {
                    item.removeAttribute("id");
                }
            });

            const label = toggleContainer.querySelector("[class*='label']") as HTMLElement;
            if (label) {
                label.querySelector("[class*='subtext']")?.remove();
                const textNode = label.childNodes[0];
                if (textNode?.nodeType === Node.TEXT_NODE) {
                    textNode.textContent = "Push to Talk";
                } else if (label.firstChild) {
                    label.firstChild.textContent = "Push to Talk";
                }
            }

            const isPTT = getInputMode() === INPUT_MODE_PTT;
            let iconContainer = toggleContainer.querySelector("[class*='iconContainer']") as HTMLElement;

            if (!iconContainer) {
                iconContainer = document.createElement("div");
                iconContainer.className = "c1e9c47c23f12ca3-iconContainer";
                const labelContainer = toggleContainer.querySelector("[class*='labelContainer']");
                labelContainer?.parentElement?.appendChild(iconContainer);
            }

            iconContainer.innerHTML = "";
            iconContainer.style.display = "flex";
            iconContainer.style.alignItems = "center";
            iconContainer.style.justifyContent = "center";

            const checkboxSvg = createCheckboxIcon(isPTT);
            iconContainer.appendChild(checkboxSvg);
            toggleContainer.setAttribute("aria-checked", String(isPTT));

            const updateCheckbox = (checked: boolean) => {
                toggleContainer.setAttribute("aria-checked", String(checked));
                const rect = checkboxSvg.querySelector("rect");
                const checkmark = checkboxSvg.querySelector("path[stroke='#FFFFFF']");

                if (rect) rect.setAttribute("fill", checked ? "var(--brand-500)" : "transparent");

                if (checked && !checkmark) {
                    const newCheckmark = document.createElementNS("http://www.w3.org/2000/svg", "path");
                    newCheckmark.setAttribute("d", "M6.5 10L9 12.5L13.5 8");
                    newCheckmark.setAttribute("stroke", "#FFFFFF");
                    newCheckmark.setAttribute("stroke-width", "2");
                    newCheckmark.setAttribute("stroke-linecap", "round");
                    newCheckmark.setAttribute("stroke-linejoin", "round");
                    newCheckmark.setAttribute("fill", "none");
                    checkboxSvg.appendChild(newCheckmark);
                } else if (!checked && checkmark) {
                    checkmark.remove();
                }
            };

            toggleContainer.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleInputMode();

                setTimeout(() => {
                    updateCheckbox(getInputMode() === INPUT_MODE_PTT);
                    const escapeEvent = new KeyboardEvent("keydown", {
                        key: "Escape",
                        code: "Escape",
                        keyCode: 27,
                        bubbles: true,
                        cancelable: true
                    });
                    menu.dispatchEvent(escapeEvent);
                }, 50);
            });

            if (!parent) return;

            if (inputProfileContainer.nextSibling) {
                parent.insertBefore(toggleContainer, inputProfileContainer.nextSibling);
            } else {
                parent.appendChild(toggleContainer);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
        this.observer = observer;
    },

    stop() {
        if (this.observer) this.observer.disconnect();
        document.querySelector("#audio-device-context-ptt-toggle")?.remove();
    },

    observer: null as MutationObserver | null,
});
