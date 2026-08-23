import definePlugin from "@utils/types";

let idleTimer: any = null;
let styleElement: HTMLStyleElement | null = null;

const lowPowerCss = `
body.k3-idle-low-power *,
body.k3-idle-low-power *::before,
body.k3-idle-low-power *::after {
    animation: none !important;
    transition: none !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
}
`;

function onBlur() {
    idleTimer = setTimeout(() => {
        document.body.classList.add("k3-idle-low-power");
    }, 30000); // 30 seconds
}

function onFocus() {
    if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
    }
    document.body.classList.remove("k3-idle-low-power");
}

export default definePlugin({
    name: "Idle Low Power",
    description: "Cuts GPU/CPU rendering overhead when Discord is left in the background for 30s.",
    authors: [{ name: "NashyLove", id: 195516525631897600n }],

    start() {
        styleElement = document.createElement("style");
        styleElement.id = "idle-low-power-style";
        styleElement.textContent = lowPowerCss;
        document.head.appendChild(styleElement);

        window.addEventListener("blur", onBlur);
        window.addEventListener("focus", onFocus);
    },

    stop() {
        styleElement?.remove();
        styleElement = null;
        onFocus();
        window.removeEventListener("blur", onBlur);
        window.removeEventListener("focus", onFocus);
    }
});