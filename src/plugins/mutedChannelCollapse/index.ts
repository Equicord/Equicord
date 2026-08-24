import definePlugin from "@utils/types";

let styleElement: HTMLStyleElement | null = null;

const css = `
/* Hide muted text and voice channels unless they contain an unread mention */
[class*="channel_"][class*="muted_"]:not(:has([class*="unread_"])):not(:has([class*="mention_"])):not(:has([class*="badge_"])) {
    display: none !important;
}

/* Optional: Subtle fade if a category itself is completely muted */
[class*="containerDefault_"]:has([class*="muted_"]) {
    opacity: 0.6;
    transition: opacity 0.15s ease-in-out;
}

[class*="containerDefault_"]:has([class*="muted_"]):hover {
    opacity: 1;
}
`;

export default definePlugin({
    name: "Muted Channel Collapse",
    description: "Automatically hides muted channels and categories unless they have active mentions.",
    authors: [{ name: "NashyLove", id: 195516525631897600n }],

    start() {
        styleElement = document.createElement("style");
        styleElement.id = "muted-channel-collapse-style";
        styleElement.textContent = css;
        document.head.appendChild(styleElement);

        console.log("%c[k3] Muted Channel Collapse Enabled", "color:#00ff88;font-weight:bold");
    },

    stop() {
        styleElement?.remove();
        styleElement = null;

        console.log("%c[k3] Muted Channel Collapse Disabled", "color:#ff5555;font-weight:bold");
    }
});