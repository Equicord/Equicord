/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, sendBotMessage } from "@api/Commands";
import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { findStore } from "@webpack";

export default definePlugin({
    name: "refreshSlashCommands",
    description: "Refreshes Slash Commands to show newly added commands without restarting your client.",
    authors: [EquicordDevs.SerStars],
    commands: [
        {
            inputType: ApplicationCommandInputType.BUILT_IN,
            name: "refresh_commands",
            description: "Refresh Slash Commands",
            execute: async (opts, ctx) => {
                try {
                    console.log("[refreshSlashCommands] Refreshing commands...");
                    sendBotMessage(ctx.channel.id, { content:"Refreshing Slash Commands..." });
                    findStore("ApplicationCommandIndexStore").indices = {}; // this basically clears the cache
                    console.log("[refreshSlashCommands] Commands refreshed successfully.");
                    sendBotMessage(ctx.channel.id, { content:"Slash Commands refreshed successfully." });
                }
                catch (e) {
                    console.error("[refreshSlashCommands] Failed to refresh commands:", e);
                    sendBotMessage(ctx.channel.id, { content:"Failed to refresh commands. Check console for details." });
                }
            }
        }
    ]
});
