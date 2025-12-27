import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export const settings = definePluginSettings({
    targetCurrency: {
        type: OptionType.STRING,
        description: "Target currency (ISO 4217, e.g. USD, EUR, GBP)",
        default: "USD"
    },

    precision: {
        type: OptionType.NUMBER,
        description: "Decimal precision",
        default: 2
    },

    autoConvertOnSend: {
        type: OptionType.BOOLEAN,
        description: "Automatically convert currencies when sending messages",
        default: false
    }
});
