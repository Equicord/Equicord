import definePlugin from "@utils/types";

let styleElement: HTMLStyleElement | null = null;

const css = `
/* Hide the large DM initial header and mutual info container */
[class*="chatContent_"] [class*="container_"]:has([class*="emptyChannelIcon_"]),
[class*="chatContent_"] [class*="header_"][class*="container_"] {
    display: none !important;
}
`;

export default definePlugin({
    name: "Compact DM Header",
    description: "Hides the massive start-of-DM header to maximize visible chat history.",
    authors: [{ name: "NashyLove", id: 195516525631897600n }],

    start() {
        styleElement = document.createElement("style");
        styleElement.id = "compact-dm-header-style";
        styleElement.textContent = css;
        document.head.appendChild(styleElement);
    },

    stop() {
        styleElement?.remove();
        styleElement = null;
    }
});