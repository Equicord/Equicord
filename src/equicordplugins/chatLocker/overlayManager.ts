export function refreshOverlay() {
    document.dispatchEvent(new CustomEvent("chatlock-refresh"));
}