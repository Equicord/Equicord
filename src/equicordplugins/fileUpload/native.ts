/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IpcMainInvokeEvent } from "electron";

import { NativeUploadResult, NestUploadResponse } from "./types";

export async function uploadToNest(
    _: IpcMainInvokeEvent,
    fileBuffer: ArrayBuffer,
    filename: string,
    authToken: string
): Promise<NativeUploadResult> {
    try {
        const formData = new FormData();
        formData.append("file", new Blob([fileBuffer]), filename);

        const response = await fetch("https://nest.rip/api/files/upload", {
            method: "POST",
            headers: {
                "Authorization": authToken
            },
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            return { success: false, error: `Upload failed: ${response.status} ${errorText}` };
        }

        const data = await response.json() as NestUploadResponse;

        if (data.fileURL) {
            return { success: true, url: data.fileURL };
        }

        return { success: false, error: "No URL returned from upload" };
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
    }
}

export async function uploadToS3(
    _: IpcMainInvokeEvent,
    fileBuffer: ArrayBuffer,
    uploadUrl: string,
    headers: Record<string, string>
): Promise<NativeUploadResult> {
    try {
        const response = await fetch(uploadUrl, {
            method: "PUT",
            headers,
            body: new Blob([fileBuffer])
        });

        if (!response.ok) {
            const errorText = await response.text();
            return { success: false, error: `Upload failed: ${response.status} ${errorText}` };
        }

        return { success: true, url: uploadUrl };
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
    }
}

export async function uploadToCatbox(
    _: IpcMainInvokeEvent,
    fileBuffer: ArrayBuffer,
    filename: string,
    userhash?: string
): Promise<NativeUploadResult> {
    try {
        const formData = new FormData();
        formData.append("reqtype", "fileupload");
        if (userhash) {
            formData.append("userhash", userhash);
        }
        formData.append("fileToUpload", new Blob([fileBuffer]), filename);

        const response = await fetch("https://catbox.moe/user/api.php", {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            return { success: false, error: `Upload failed: ${response.status} ${errorText}` };
        }

        const text = (await response.text()).trim();
        if (!text) {
            return { success: false, error: "No URL returned from upload" };
        }

        return { success: true, url: text };
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
    }
}

export async function uploadToLitterbox(
    _: IpcMainInvokeEvent,
    fileBuffer: ArrayBuffer,
    filename: string,
    expiry: string
): Promise<NativeUploadResult> {
    try {
        const formData = new FormData();
        formData.append("reqtype", "fileupload");
        formData.append("time", expiry);
        formData.append("fileToUpload", new Blob([fileBuffer]), filename);

        const response = await fetch("https://litterbox.catbox.moe/resources/internals/api.php", {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            return { success: false, error: `Upload failed: ${response.status} ${errorText}` };
        }

        const text = (await response.text()).trim();
        if (!text) {
            return { success: false, error: "No URL returned from upload" };
        }

        return { success: true, url: text };
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
    }
}

function isValidHttpsUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.protocol === "https:";
    } catch {
        return false;
    }
}

export async function uploadToWebdav(
    _: IpcMainInvokeEvent,
    fileBuffer: ArrayBuffer,
    uploadUrl: string,
    headers: Record<string, string>
): Promise<NativeUploadResult> {
    if (!isValidHttpsUrl(uploadUrl)) {
        return { success: false, error: "Invalid or non-HTTPS upload URL" };
    }

    try {
        const response = await fetch(uploadUrl, {
            method: "PUT",
            headers,
            body: new Blob([fileBuffer])
        });

        if (!response.ok) {
            const errorText = await response.text();
            return { success: false, error: `Upload failed: ${response.status} ${errorText}` };
        }

        return { success: true, url: uploadUrl };
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
    }
}

export async function createWebdavShare(
    _: IpcMainInvokeEvent,
    ocsUrl: string,
    headers: Record<string, string>,
    body: string
): Promise<NativeUploadResult> {
    if (!isValidHttpsUrl(ocsUrl)) {
        return { success: false, error: "Invalid or non-HTTPS share endpoint URL" };
    }

    try {
        const response = await fetch(ocsUrl, {
            method: "POST",
            headers,
            body
        });

        const text = await response.text();

        if (!response.ok) {
            return { success: false, error: `Share creation failed: ${response.status} ${text.slice(0, 200)}` };
        }

        let data: { ocs?: { data?: { token?: string; }; }; };
        try {
            data = JSON.parse(text);
        } catch {
            return { success: false, error: `Invalid share response: ${text.slice(0, 200)}` };
        }

        const token = data?.ocs?.data?.token;
        if (!token) {
            return { success: false, error: "No share token in server response" };
        }

        return { success: true, url: token };
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
    }
}
