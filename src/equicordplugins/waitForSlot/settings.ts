import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export const settings = definePluginSettings({
    promptOnFull: {
        type: OptionType.BOOLEAN,
        description: "Prompt to wait when selecting a full voice channel",
        default: true,
        restartNeeded: false,
    },
    showConfirmation: {
        type: OptionType.BOOLEAN,
        description: "Show confirmation modal when a slot becomes available",
        default: true,
        restartNeeded: false,
    },
    playSound: {
        type: OptionType.BOOLEAN,
        description: "Play notification sound when a slot becomes available",
        default: true,
        restartNeeded: false,
    },
    promptOnReplace: {
        type: OptionType.BOOLEAN,
        description: "Prompt to replace the current wait queue when selecting another full voice channel",
        default: true,
        restartNeeded: false,
    },
});
