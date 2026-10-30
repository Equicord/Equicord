import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";
import data from "./maps/data.json";

const choices = Object.entries(data.langs).map(([value, label]) => ({
    name: label,
    value,
    label
}));

export const settings = definePluginSettings({
    language: {
        type: OptionType.SELECT,
        description: "select your secondary keyboard language",
        options: choices,
        default: data.deflang
    }
});
