/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "NoOnboarding",
    description: "Skips the server onboarding by gaslighting it",
    tags: ["Servers", "Utility"],
    authors: [EquicordDevs.secp192k1],
    patches: [
        {
            find: 'type:"GUILD_ONBOARDING_PROMPTS_FETCH_START"',
            replacement: {
                match: /(?<="GUILD_ONBOARDING_PROMPTS_FETCH_SUCCESS",guildId:\i,\.\.\.\i)(?=\})/,
                replace: ",enabled:!1"
            }
        }
    ]
});
