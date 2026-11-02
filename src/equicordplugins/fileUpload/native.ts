/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NativeSettings } from "@main/settings";
import { dialog, IpcMainInvokeEvent } from "electron";

import { NativeRequestBody, NativeRequestOptions, NativeRequestResult } from "./types";

// Hosts the plugin uploads to by design. Anything else (S3 buckets, WebDAV
// servers, Zipline instances, ShareX uploaders) requires user approval.
const TrustedHosts = new Set([
    "0x0.st",
    "api.e-z.host",
    "catbox.moe",
    "encrypting.host",
    "filebin.net",
    "litterbox.catbox.moe",
    "nest.rip",
    "pixelvault.co",
    "pixeldrain.com",
    "temp.sh",
    "tmpfiles.org",
    "upload.gofile.io",
    "w.buzzheavier.com"
]);

const AllowedMethods = new Set(["DELETE", "GET", "HEAD", "PATCH", "POST", "PUT"]);

function getApprovedOrigins(): string[] {
    return NativeSettings.store.plugins.FileUpload?.approvedOrigins ?? [];
}

async function isOriginApproved(url: string): Promise<boolean> {
    const { hostname, origin } = new URL(url);
    if (TrustedHosts.has(hostname) || getApprovedOrigins().includes(origin)) return true;

    const { response } = await dialog.showMessageBox({
        type: "warning",
        title: "Equicord FileUpload",
        message: `FileUpload wants to upload files to ${origin}`,
        detail: `Unless you recognise and fully trust ${origin}, you should cancel this request!\n\nTrust remembers this server, Allow only permits this request.`,
        buttons: ["Trust", "Allow", "Cancel"],
        defaultId: 2,
        cancelId: 2
    });

    if (response === 2) return false;
    if (response === 1) return true;

    NativeSettings.store.plugins.FileUpload ??= {};
    NativeSettings.store.plugins.FileUpload.approvedOrigins = [...getApprovedOrigins(), origin];
    return true;
}

export function clearApprovedOrigins() {
    if (NativeSettings.store.plugins.FileUpload) {
        NativeSettings.store.plugins.FileUpload.approvedOrigins = [];
    }
}

function failure(error: string): NativeRequestResult {
    return { ok: false, status: 0, statusText: "", headers: {}, text: "", error };
}

function buildBody(body: NativeRequestBody, headers: Record<string, string>): { body?: FormData | string | Blob; error?: string; } {
    switch (body.type) {
        case "text":
            return { body: body.text };
        case "raw":
            if (!(body.data instanceof ArrayBuffer)) return { error: "Invalid request body" };
            return { body: new Blob([body.data]) };
        case "multipart": {
            if (!Array.isArray(body.fields) || body.fields.some(([key, value]) => typeof key !== "string" || typeof value !== "string")) {
                return { error: "Invalid multipart fields" };
            }

            const { file } = body;
            if (!file || !(file.data instanceof ArrayBuffer) || typeof file.filename !== "string") {
                return { error: "Invalid multipart file" };
            }

            for (const key of Object.keys(headers)) {
                if (key.toLowerCase() === "content-type") delete headers[key];
            }

            const filePart = new Blob([file.data], { type: file.contentType });
            const fileIndex = typeof body.fileIndex === "number" && Number.isInteger(body.fileIndex) && body.fileIndex >= 0
                ? body.fileIndex
                : body.fields.length;

            const form = new FormData();
            for (let i = 0; i < body.fields.length; i++) {
                if (i === fileIndex) {
                    form.append(file.field, filePart, file.filename);
                }
                form.append(body.fields[i][0], body.fields[i][1]);
            }
            if (fileIndex >= body.fields.length) {
                form.append(file.field, filePart, file.filename);
            }
            return { body: form };
        }
        default:
            return { error: "Invalid request body" };
    }
}

export async function request(
    _: IpcMainInvokeEvent,
    options: NativeRequestOptions
): Promise<NativeRequestResult> {
    try {
        if (!options || typeof options.url !== "string") {
            return failure("Invalid request options");
        }

        const url = new URL(options.url);
        if (url.protocol !== "https:") {
            return failure("Only HTTPS URLs are allowed");
        }

        const method = (options.method || "GET").toUpperCase();
        if (!AllowedMethods.has(method)) {
            return failure(`Unsupported request method ${method}`);
        }

        const headers: Record<string, string> = {};
        for (const [key, value] of Object.entries(options.headers || {})) {
            if (typeof key === "string" && typeof value === "string") {
                headers[key] = value;
            }
        }

        const built = options.body ? buildBody(options.body, headers) : { body: undefined };
        if (built.error) return failure(built.error);

        if (!await isOriginApproved(options.url)) {
            return failure("Upload server was not approved");
        }

        const timeoutMs = typeof options.timeoutMs === "number" && Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
            ? options.timeoutMs
            : 300000;

        const response = await fetch(url, {
            method,
            headers,
            body: built.body,
            signal: AbortSignal.timeout(timeoutMs)
        });

        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
            responseHeaders[key] = value;
        });

        return {
            ok: response.ok,
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
            text: await response.text()
        };
    } catch (e) {
        if (e instanceof Error && e.name === "TimeoutError") {
            return failure("Upload timed out");
        }

        return failure(e instanceof Error ? e.message : "Unknown error");
    }
}

const allowedHosts = new Set([
    "cdn.discordapp.com",
    "images-ext-1.discordapp.net",
    "images-ext-2.discordapp.net",
    "media.discordapp.net"
]);

export async function fetchFile(
    _: IpcMainInvokeEvent,
    url: string
): Promise<{ success: boolean; data?: ArrayBuffer; contentType?: string; error?: string; }> {
    try {
        if (!allowedHosts.has(new URL(url).hostname)) {
            return { success: false, error: "Unknown URL" };
        }

        const response = await fetch(url);
        if (!response.ok) {
            return { success: false, error: `Fetch failed: ${response.status} ${response.statusText}` };
        }

        const data = await response.arrayBuffer();
        const contentType = response.headers.get("content-type") || "";

        return { success: true, data, contentType };
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
    }
}
