import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

const settings = definePluginSettings({
    maxLogEntries: {
        type: OptionType.NUMBER,
        description: "Maximum number of log entries to keep (0 for unlimited)",
        default: 1000,
    },

    iconLocation: {
        description: "Where to show the Console Log icon",
        type: OptionType.SELECT,
        options: [
            { label: "Toolbar", value: "toolbar", default: true },
            { label: "Chat input", value: "chat" }
        ],
        restartNeeded: true
    },

    groupSimilarLogs: {
        type: OptionType.BOOLEAN,
        description: "Group similar consecutive logs",
        default: true
    },

    preserveLogsBetweenSessions: {
        type: OptionType.BOOLEAN,
        description: "Save logs between plugin restarts or Discord sessions",
        default: false
    },

    syntaxHighlighting: {
        type: OptionType.BOOLEAN,
        description: "Enable syntax highlighting for objects and code",
        default: true
    }
});

export default settings;
