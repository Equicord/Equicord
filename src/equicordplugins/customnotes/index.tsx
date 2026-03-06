import definePlugin, { OptionType } from "@utils/types";
import { definePluginSettings } from "@api/Settings";

const settings = definePluginSettings({
    customNotes: {
        type: OptionType.STRING,
        description: "The text that will be your current notes. It applies to everyone’s notes, and currently there is no way to fix this. I have tried [DEAL WITH IT]",
        default: ""
    }
});
export default definePlugin({
    name: "CustomNotes",
    authors: [EquicordDevs.bratic],
    description: "Go beyond the 256-character limit in your notes.",
    settings,
    start() {
        const applyCustomNotes = () => {
            const textareas = document.querySelectorAll<HTMLTextAreaElement>(
                'textarea[placeholder="Click to add a note"], textarea[aria-label="Note"]'
            );
            textareas.forEach(textarea => {
                if (!textarea.value) {
                    textarea.value = settings.store.customNotes || "";
                }
            });
        };

        applyCustomNotes();
        const interval = window.setInterval(applyCustomNotes, 2000);
        (this as any).interval = interval;
        const observer = new MutationObserver(() => applyCustomNotes());
        observer.observe(document.body, { childList: true, subtree: true });
        (this as any).observer = observer;
    },
    stop() {
        (this as any).observer?.disconnect();
        clearInterval((this as any).interval);
    }
});