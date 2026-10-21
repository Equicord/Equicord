/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { RendererSettings } from "@main/settings";
import { app, session } from "electron";

app.whenReady().then(() => {
    session.defaultSession.webRequest.onBeforeSendHeaders({ urls: ["https://www.youtube.com/embed/*"] }, ({ requestHeaders, resourceType }, callback) => {
        if (resourceType === "subFrame" && RendererSettings.store.plugins?.FixYoutubeEmbeds?.enabled)
            requestHeaders.Referer = "https://media.discordapp.com/";

        callback({ requestHeaders });
    });
});
