/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { WebContents } from "electron";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { dirname, join } from "path";

import { DATA_DIR } from "./utils/constants";

const PINNED_DIR = join(DATA_DIR, "pinnedBuilds");

export function disableDiscordUpdates() {
    const path = process.platform === "darwin"
        ? join(process.resourcesPath, "updater.node")
        : join(dirname(process.execPath), "updater.node");
    if (!existsSync(path)) return;

    const updaterModule = require(path);
    const { Updater } = updaterModule;
    updaterModule.Updater = function (options: { response_handler(response: string): void; }) {
        const updater = new Updater(options);
        const { command } = updater;
        return Object.defineProperty(updater, "command", {
            value(request: string) {
                const [id, detail] = JSON.parse(request);
                if (detail.UpdateToLatest) setImmediate(() => options.response_handler(JSON.stringify([id, "Ok"])));
                else command.call(updater, request);
            }
        });
    };
}

export function unpinDiscordBuild() {
    rmSync(PINNED_DIR, { recursive: true, force: true });
}

export function pinDiscordBuild(webContents: WebContents) {
    const { debugger: dbg } = webContents;
    dbg.attach();
    dbg.sendCommand("Fetch.enable", {
        patterns: [
            { urlPattern: "https://*discord.com/*", resourceType: "Document", requestStage: "Response" },
            { urlPattern: "https://*discord.com/assets/version.*", requestStage: "Request" }
        ]
    });

    dbg.on("message", async (_, method, { requestId, request, responseStatusCode, responseHeaders }) => {
        if (method !== "Fetch.requestPaused") return;

        const continueRequest = () => dbg.sendCommand("Fetch.continueRequest", { requestId });
        const fulfillRequest = (headers: { name: string; value: string; }[], body: string) => dbg.sendCommand("Fetch.fulfillRequest", {
            requestId,
            responseCode: 200,
            responseHeaders: headers,
            body: Buffer.from(body).toString("base64")
        });

        const file = join(PINNED_DIR, `${new URL(request.url).host}.html`);
        const pinned = existsSync(file) ? readFileSync(file, "utf-8") : null;

        if (request.url.includes("/assets/version.")) {
            const hash = pinned?.match(/"VERSION_HASH":"(\w+)"/)?.[1];
            return hash ? fulfillRequest([{ name: "Content-Type", value: "application/json" }], JSON.stringify({ hash })) : continueRequest();
        }

        if (responseStatusCode !== 200) return continueRequest();

        if (!pinned) {
            const { body, base64Encoded } = await dbg.sendCommand("Fetch.getResponseBody", { requestId });
            const html = base64Encoded ? Buffer.from(body, "base64").toString() : body;
            if (html.includes("\"VERSION_HASH\"")) {
                mkdirSync(PINNED_DIR, { recursive: true });
                writeFileSync(file, html);
            }
            return continueRequest();
        }

        const nonce = responseHeaders.find(({ name }) => name.toLowerCase() === "content-security-policy")?.value.match(/'nonce-([^']+)'/)?.[1];
        return fulfillRequest(
            responseHeaders.filter(({ name }) => !/^content-(encoding|length)$/i.test(name)),
            nonce ? pinned.replace(/nonce="[^"]*"/g, `nonce="${nonce}"`) : pinned
        );
    });
}
