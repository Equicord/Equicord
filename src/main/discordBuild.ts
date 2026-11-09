/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { WebContents } from "electron";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "fs";
import { readFile } from "fs/promises";
import pLimit from "p-limit";
import { basename, dirname, extname, join } from "path";

import { DATA_DIR } from "./utils/constants";
import { fetchBuffer } from "./utils/http";

const PINNED_DIR = join(DATA_DIR, "pinnedBuilds");
const CHUNKS_DIR = join(PINNED_DIR, "chunks");
const MIME_TYPES: Record<string, string> = {
    ".js": "text/javascript",
    ".css": "text/css",
    ".svg": "image/svg+xml",
    ".wasm": "application/wasm"
};

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

export function unpinDiscordChunks() {
    rmSync(CHUNKS_DIR, { recursive: true, force: true });
}

const assetNames = (code: string) => [
    ...Array.from(code.matchAll(/"(?:\/assets\/)?((?:\w+\.)?[0-9a-f]{16,}(?:\.module)?\.\w+)"/g), m => m[1]),
    ...Array.from(code.matchAll(/\.v\(\w+,\w+\.id,"([0-9a-f]{16,})"/g), m => `${m[1]}.module.wasm`),
    ...Array.from(code.matchAll(/url\(\/assets\/([\w.-]+)\)/g), m => m[1]),
    ...Array.from(code.matchAll(/(\d[\d.e]*)===\w\)return""\+\w\+"\.([0-9a-f]{16}\.(?:js|css))"/g), m => `${Number(m[1])}.${m[2]}`),
    ...Array.from(code.matchAll(/\(\{(?:[\d.e]+:"[0-9a-f]{16}",?)+\}\)\[\w\]\+"\.(js|css)"/g), m => Array.from(m[0].matchAll(/"([0-9a-f]{16})"/g), h => `${h[1]}.${m[1]}`)).flat()
];

let downloadingChunks = false;

async function downloadChunks(origin: string, html: string) {
    const done = join(CHUNKS_DIR, ".done");
    if (downloadingChunks || existsSync(done)) return;
    downloadingChunks = true;
    mkdirSync(CHUNKS_DIR, { recursive: true });

    const seen = new Set<string>();
    const limit = pLimit(16);
    let failed = 0;

    const visit = (code: string): Promise<unknown> => Promise.all(assetNames(code).map(name => {
        if (seen.has(name)) return;
        seen.add(name);

        const file = join(CHUNKS_DIR, name);
        return limit(async () => {
            if (existsSync(file)) return;
            writeFileSync(`${file}.tmp`, await fetchBuffer(`${origin}/assets/${name}`));
            renameSync(`${file}.tmp`, file);
        })
            .then(async () => /\.(js|css)$/.test(name) && visit(await readFile(file, "utf-8")))
            .catch(() => failed++);
    }));

    await visit(html);
    if (failed) console.error(`[Equicord] Failed to download ${failed} of ${seen.size} Discord assets`);
    else writeFileSync(done, "");
}

export function pinDiscordBuild(webContents: WebContents, pinChunks?: boolean) {
    const { debugger: dbg } = webContents;
    dbg.attach();
    dbg.sendCommand("Fetch.enable", {
        patterns: [
            { urlPattern: "https://*discord.com/*", resourceType: "Document", requestStage: "Response" },
            { urlPattern: `https://*discord.com/assets/${pinChunks ? "*" : "version.*"}`, requestStage: "Request" }
        ]
    });

    dbg.on("message", async (_, method, { requestId, request, responseStatusCode, responseHeaders }) => {
        if (method !== "Fetch.requestPaused") return;

        const continueRequest = () => dbg.sendCommand("Fetch.continueRequest", { requestId });
        const fulfillRequest = (headers: { name: string; value: string; }[], body: Buffer) => dbg.sendCommand("Fetch.fulfillRequest", {
            requestId,
            responseCode: 200,
            responseHeaders: headers,
            body: body.toString("base64")
        });

        const url = new URL(request.url);

        if (pinChunks && url.pathname.startsWith("/assets/")) {
            const asset = await readFile(join(CHUNKS_DIR, basename(url.pathname))).catch(() => null);
            const type = MIME_TYPES[extname(url.pathname)];
            if (asset) return fulfillRequest(type ? [{ name: "Content-Type", value: type }] : [], asset);
        }

        const file = join(PINNED_DIR, `${url.host}.html`);
        const pinned = existsSync(file) ? readFileSync(file, "utf-8") : null;

        if (url.pathname.startsWith("/assets/version.")) {
            const hash = pinned?.match(/"VERSION_HASH":"(\w+)"/)?.[1];
            return hash ? fulfillRequest([{ name: "Content-Type", value: "application/json" }], Buffer.from(JSON.stringify({ hash }))) : continueRequest();
        }

        if (responseStatusCode !== 200) return continueRequest();

        if (!pinned) {
            const { body, base64Encoded } = await dbg.sendCommand("Fetch.getResponseBody", { requestId });
            const html = base64Encoded ? Buffer.from(body, "base64").toString() : body;
            if (html.includes("\"VERSION_HASH\"")) {
                mkdirSync(PINNED_DIR, { recursive: true });
                writeFileSync(file, html);
                if (pinChunks) downloadChunks(url.origin, html);
            }
            return continueRequest();
        }

        if (pinChunks) downloadChunks(url.origin, pinned);

        const nonce = responseHeaders.find(({ name }) => name.toLowerCase() === "content-security-policy")?.value.match(/'nonce-([^']+)'/)?.[1];
        return fulfillRequest(
            responseHeaders.filter(({ name }) => !/^content-(encoding|length)$/i.test(name)),
            Buffer.from(nonce ? pinned.replace(/nonce="[^"]*"/g, `nonce="${nonce}"`) : pinned)
        );
    });
}
