/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { app, net, protocol } from "electron";
import { join } from "path";
import { pathToFileURL } from "url";

import { initCsp } from "./csp";
import { ensureSafePath } from "./ipcMain";
import { RendererSettings } from "./settings";
import { IS_VANILLA, THEMES_DIR } from "./utils/constants";
import { installExt } from "./utils/extensions";

if (!IS_VANILLA && !IS_EXTENSION) {
    app.setAsDefaultProtocolClient("equicord");

    const handleEquicordUrl = (urlStr: string) => {
        try {
            const url = new URL(urlStr);
            if (url.protocol === "equicord:") {
                switch (url.hostname) {
                    case "install-theme":
                        const id = url.searchParams.get("id");
                        if (id) {
                            const { BrowserWindow } = require("electron");
                            BrowserWindow.getAllWindows().forEach(win => {
                                win.webContents.send("VencordInstallTheme", id);
                            });
                        }
                        break;

                }
            }
        } catch (e) {
            console.error("[Equicord] Failed to parse protocol URL", e);
        }
    };

    app.on("second-instance", (event, commandLine, workingDirectory) => {
        const url = commandLine.find(arg => arg.startsWith("equicord://"));
        if (url) {
            console.log("[Equicord] Protocol URL opened:", url);
            handleEquicordUrl(url);
        }
    });

    app.on("open-url", (event, url) => {
        if (url.startsWith("equicord://")) {
            event.preventDefault();
            console.log("[Equicord] Protocol URL opened:", url);
            handleEquicordUrl(url);
        }
    });

    app.whenReady().then(() => {
        protocol.handle("vencord", ({ url: unsafeUrl }) => {
            let url = decodeURI(unsafeUrl).slice("vencord://".length).replace(/\?v=\d+$/, "");

            if (url.endsWith("/")) url = url.slice(0, -1);

            if (url.startsWith("/themes/")) {
                const theme = url.slice("/themes/".length);

                const safeUrl = ensureSafePath(THEMES_DIR, theme);
                if (!safeUrl) {
                    return new Response(null, {
                        status: 404
                    });
                }

                return net.fetch(pathToFileURL(safeUrl).toString());
            }

            // Source Maps! Maybe there's a better way but since the renderer is executed
            // from a string I don't think any other form of sourcemaps would work

            switch (url) {
                case "renderer.js.map":
                case "preload.js.map":
                case "patcher.js.map":
                case "main.js.map":
                    return net.fetch(pathToFileURL(join(__dirname, url)).toString());
                default:
                    return new Response(null, {
                        status: 404
                    });
            }
        });

        protocol.handle("equicord", ({ url: unsafeUrl }) => {
            let url = decodeURI(unsafeUrl).slice("equicord://".length).replace(/\?v=\d+$/, "");

            if (url.endsWith("/")) url = url.slice(0, -1);

            if (url.startsWith("/themes/")) {
                const theme = url.slice("/themes/".length);

                const safeUrl = ensureSafePath(THEMES_DIR, theme);
                if (!safeUrl) {
                    return new Response(null, {
                        status: 404
                    });
                }

                return net.fetch(pathToFileURL(safeUrl).toString());
            }

            // Source Maps! Maybe there's a better way but since the renderer is executed
            // from a string I don't think any other form of sourcemaps would work

            switch (url) {
                case "renderer.js.map":
                case "preload.js.map":
                case "patcher.js.map":
                case "main.js.map":
                    return net.fetch(pathToFileURL(join(__dirname, url)).toString());
                default:
                    return new Response(null, {
                        status: 404
                    });
            }
        });

        try {
            if (RendererSettings.store.enableReactDevtools)
                installExt("fmkadmapgofadopljbjfkapdkoienihi")
                    .then(() => console.info("[Equicord] Installed React Developer Tools"))
                    .catch(err => console.error("[Equicord] Failed to install React Developer Tools", err));
        } catch { }

        initCsp();
    });
}

if (IS_DISCORD_DESKTOP) {
    require("./patcher");
}
