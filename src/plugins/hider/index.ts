import definePlugin from "@utils/types";

let styleElement: HTMLStyleElement | null = null;

const css = `
[class*="devBanner_"] {
    display: none !important;
}
`;

export default definePlugin({
    name: "k3 hider",
    description: "Hides the Canary build / Equicord dev banner watermark.",
    authors: [{ name: "NashyLove", id: 195516525631897600n }],

    start() {
        styleElement = document.createElement("style");
        styleElement.id = "k3-hider-style";
        styleElement.textContent = css;
        document.head.appendChild(styleElement);

        console.log("%c[k3 hider] Enabled", "color:#00ff88;font-weight:bold");
    },

    stop() {
        styleElement?.remove();
        styleElement = null;

        console.log("%c[k3 hider] Disabled", "color:#ff5555;font-weight:bold");
    }
});