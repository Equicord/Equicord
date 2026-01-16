/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { PremiumType } from "@vencord/discord-types/enums";
import { OverridePremiumTypeStore } from "@webpack/common";

export default definePlugin({
    name: "NoNitroUpsell",
    description: "Removes ALL of Discord's nitro upsells by tricking the client into thinking you have nitro.",
    authors: [Devs.thororen],
    flux: {
        CONNECTION_OPEN() {
            const state = OverridePremiumTypeStore.getState();
            if (state.premiumTypeActual !== PremiumType.TIER_2 || state.premiumTypeOverride === PremiumType.TIER_2) return;
            state.premiumTypeOverride = PremiumType.TIER_2;
        }
    },
    start() {
        OverridePremiumTypeStore.getState().premiumTypeOverride = PremiumType.TIER_2;
    },
    stop() {
        OverridePremiumTypeStore.getState().premiumTypeOverride = undefined;
    }
});
