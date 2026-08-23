import definePlugin from "@utils/types";

function handlePaste(e: ClipboardEvent) {
    const activeEl = document.activeElement;
    if (!activeEl || !activeEl.getAttribute("role")?.includes("textbox")) return;

    const pastedText = e.clipboardData?.getData("text");
    if (!pastedText) return;

    // Clean duplicate @ symbols (e.g. @@user -> @user) and trailing mention spaces
    const cleanedText = pastedText.replace(/@+(\w+)/g, "@$1").trim();

    if (cleanedText !== pastedText) {
        e.preventDefault();
        document.execCommand("insertText", false, cleanedText);
    }
}

export default definePlugin({
    name: "Silent Mention Cleaner",
    description: "Automatically formats pasted text to fix duplicate @ signs and trailing spaces.",
    authors: [{ name: "NashyLove", id: 195516525631897600n }],

    start() {
        document.addEventListener("paste", handlePaste, true);
    },

    stop() {
        document.removeEventListener("paste", handlePaste, true);
    }
});