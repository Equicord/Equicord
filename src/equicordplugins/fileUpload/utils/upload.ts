/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { settings } from "@equicordplugins/fileUpload/index";
import { ServiceType, UploadResponse } from "@equicordplugins/fileUpload/types";
import { copyToClipboard } from "@utils/clipboard";
import { showToast, Toasts } from "@webpack/common";

const Native = IS_DISCORD_DESKTOP
    ? VencordNative.pluginHelpers.FileUpload as PluginNative<typeof import("../native")>
    : null;

import { convertApngToGif } from "./apngToGif";
import { getExtensionFromBytes, getExtensionFromMime, getMimeFromExtension, getUrlExtension } from "./getMediaUrl";

let isUploading = false;

async function uploadToZipline(fileBlob: Blob, filename: string): Promise<string> {
    const { serviceUrl, ziplineToken, folderId } = settings.store;

    if (!serviceUrl || !ziplineToken) {
        throw new Error("Service URL and auth token are required");
    }

    const baseUrl = serviceUrl.replace(/\/+$/, "");
    const formData = new FormData();
    formData.append("file", fileBlob, filename);

    const headers: Record<string, string> = {
        "Authorization": ziplineToken
    };

    if (folderId) {
        headers["x-zipline-folder"] = folderId;
    }

    const response = await fetch(`${baseUrl}/api/upload`, {
        method: "POST",
        headers,
        body: formData
    });

    const responseContentType = response.headers.get("content-type") || "";

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${response.status} ${errorText}`);
    }

    if (!responseContentType.includes("application/json")) {
        throw new Error("Server returned invalid response (not JSON)");
    }

    const data: UploadResponse = await response.json();

    if (data.files && data.files.length > 0 && data.files[0].url) {
        return data.files[0].url;
    }

    throw new Error("No URL returned from upload");
}

async function uploadToNest(fileBlob: Blob, filename: string): Promise<string> {
    if (!Native) {
        throw new Error("Nest upload is only available on desktop");
    }

    const { nestToken } = settings.store;

    if (!nestToken) {
        throw new Error("Auth token is required");
    }

    const arrayBuffer = await fileBlob.arrayBuffer();
    const result = await Native.uploadToNest(arrayBuffer, filename, nestToken);

    if (!result.success) {
        throw new Error(result.error || "Upload failed");
    }

    if (!result.url) {
        throw new Error("No URL returned from upload");
    }

    return result.url;
}

export function isConfigured(): boolean {
    const { serviceType, serviceUrl, ziplineToken, nestToken } = settings.store;
    if (serviceType === ServiceType.NEST) {
        return Boolean(nestToken);
    }
    return Boolean(serviceUrl && ziplineToken);
}

export async function uploadFile(url: string): Promise<void> {
    if (isUploading) {
        showToast("Upload already in progress", Toasts.Type.MESSAGE);
        return;
    }

    if (!isConfigured()) {
        showToast("Please configure FileUpload settings first", Toasts.Type.FAILURE);
        return;
    }

    const serviceType = settings.store.serviceType as ServiceType;

    isUploading = true;

    try {
        let fetchUrl = url;
        if (url.includes("/stickers/") && url.includes("passthrough=false")) {
            fetchUrl = url.replace("passthrough=false", "passthrough=true");
        }

        const response = await fetch(fetchUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch file: ${response.status}`);
        }

        const contentType = response.headers.get("content-type") || "";
        let blob = await response.blob();
        let ext = await getExtensionFromBytes(blob) || getExtensionFromMime(contentType) || getExtensionFromMime(blob.type) || getUrlExtension(url) || "png";

        if (ext === "apng" && settings.store.apngToGif) {
            const gifBlob = await convertApngToGif(blob);
            if (gifBlob) {
                blob = gifBlob;
                ext = "gif";
            } else {
                showToast("APNG to GIF conversion failed, uploading as APNG", Toasts.Type.FAILURE);
            }
        }

        const mimeType = getMimeFromExtension(ext);
        const typedBlob = new Blob([blob], { type: mimeType });
        const filename = `upload.${ext}`;

        let uploadedUrl: string;

        switch (serviceType) {
            case ServiceType.ZIPLINE:
                uploadedUrl = await uploadToZipline(typedBlob, filename);
                break;
            case ServiceType.NEST:
                uploadedUrl = await uploadToNest(typedBlob, filename);
                break;
            default:
                throw new Error("Unknown service type");
        }

        let finalUrl = uploadedUrl;
        if (settings.store.stripQueryParams) {
            try {
                const parsed = new URL(uploadedUrl);
                parsed.search = "";
                finalUrl = parsed.href;
            } catch {
                finalUrl = uploadedUrl;
            }
        }

        if (settings.store.autoCopy) {
            copyToClipboard(finalUrl);
            showToast("Upload successful, URL copied to clipboard", Toasts.Type.SUCCESS);
        } else {
            showToast("Upload successful", Toasts.Type.SUCCESS);
        }

    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        showToast(`Upload failed: ${message}`, Toasts.Type.FAILURE);
        console.error("[FileUpload] Upload error:", error);
    } finally {
        isUploading = false;
    }
}
