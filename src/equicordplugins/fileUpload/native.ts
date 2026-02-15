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

export async function uploadToEzHost(
    _: IpcMainInvokeEvent,
    fileBuffer: ArrayBuffer,
    filename: string,
    key: string
): Promise<NativeUploadResult> {
    try {
        const formData = new FormData();
        formData.append("file", new Blob([fileBuffer]), filename);

        const response = await fetch("https://api.e-z.host/files", {
            method: "POST",
            headers: {
                key
            },
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            return { success: false, error: `Upload failed: ${response.status} ${errorText}` };
        }

        const data = await response.json() as { success: boolean; error?: string; imageUrl?: string; rawUrl?: string; };

        if (!data || !data.success) {
            return { success: false, error: data?.error || "Upload failed" };
        }

        if (data.imageUrl || data.rawUrl) {
            return { success: true, url: data.imageUrl || data.rawUrl };
        }

        return { success: false, error: "No URL returned from upload" };
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
    }
}

export async function fetchFile(

    _: IpcMainInvokeEvent,

    url: string

): Promise<{ success: boolean; data?: ArrayBuffer; contentType?: string; error?: string }> {

    try {

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
