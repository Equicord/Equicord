import { FluxDispatcher } from "@webpack/common";
import definePlugin from "@utils/types";

const EXPERIMENT_ID = "2025-09-user-settings-redesign-1";

export default definePlugin({
    name: "OldSettings",
    description: "Restores the classic settings menu by disabling the 2025 redesign experiment.\nYou need to reopen the settings menu to see the changes.",
    authors: [
        {
            name: "sankoofa",
            id: 279448683672502274n
        }
    ],

    start() {
        FluxDispatcher.dispatch({
            type: "APEX_EXPERIMENT_OVERRIDE_CREATE",
            experimentName: EXPERIMENT_ID,
            variantId: 0
        });
    },

    stop() {
        FluxDispatcher.dispatch({
            type: "APEX_EXPERIMENT_OVERRIDE_DELETE",
            experimentName: EXPERIMENT_ID
        });
    }
});
