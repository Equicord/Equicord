/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { settings } from "@equicordplugins/fileUpload/index";
import { ServiceType, UploadResponse } from "@equicordplugins/fileUpload/types";
import { copyToClipboard } from "@utils/clipboard";
import { PluginNative } from "@utils/types";
import { showToast, Toasts } from "@webpack/common";

import { convertApngToGif } from "./apngToGif";
import { getExtensionFromBytes, getExtensionFromMime, getMimeFromExtension, getUrlExtension } from "./getMediaUrl";

const Native = IS_DISCORD_DESKTOP
    ? VencordNative.pluginHelpers.FileUpload as PluginNative<typeof import("../native")>
    : null;

const CORS_PROXY = "https://cors.keiran0.workers.dev"; // im hosting this on cloudflare workers so uptime and latency should be reliable

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
    const { nestToken } = settings.store;

    if (!nestToken) {
        throw new Error("Auth token is required");
    }

    if (Native) {
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

    const formData = new FormData();
    formData.append("file", fileBlob, filename);

    const proxiedUrl = `${CORS_PROXY}?url=${encodeURIComponent("https://nest.rip/api/files/upload")}`;

    const response = await fetch(proxiedUrl, {
        method: "POST",
        headers: {
            "Authorization": nestToken
        },
        body: formData
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${response.status} ${errorText}`);
    }

    const data = await response.json() as { fileURL?: string };

    if (data.fileURL) {
        return data.fileURL;
    }

    throw new Error("No URL returned from upload");
}

export function isConfigured(): boolean {
    const { serviceType, serviceUrl, ziplineToken, nestToken } = settings.store;
    switch (serviceType) {
        case ServiceType.NEST:
            return Boolean(nestToken);
        case ServiceType.EZHOST:
            return Boolean((settings.store as { ezHostKey?: string }).ezHostKey);
        case ServiceType.CATBOX:
        case ServiceType.ZEROX0:
        case ServiceType.LITTERBOX:
            return true;
        case ServiceType.ZIPLINE:
        default:
            return Boolean(serviceUrl && ziplineToken);
    }
}

async function uploadToEzHost(fileBlob: Blob, filename: string): Promise<string> {
    const { ezHostKey } = (settings.store as { ezHostKey?: string });

    if (!ezHostKey) throw new Error("E-Z Host API key is required");

    if (Native) {
        const arrayBuffer = await fileBlob.arrayBuffer();
        const result = await Native.uploadToEzHost(arrayBuffer, filename, ezHostKey);

        if (!result.success) {
            throw new Error(result.error || "Upload failed");
        }

        if (!result.url) {
            throw new Error("No URL returned from upload");
        }

        return result.url;
    }

    const formData = new FormData();
    formData.append("file", fileBlob, filename);

    const headers: Record<string, string> = { key: ezHostKey };

    const proxiedUrl = `${CORS_PROXY}?url=${encodeURIComponent("https://api.e-z.host/files")}`;
    const response = await fetch(proxiedUrl, {
        method: "POST",
        headers,
        body: formData
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Upload failed: ${response.status} ${text}`);
    }

    const data = await response.json();
    if (!data || !data.success) {
        throw new Error(data?.error || "Upload failed");
    }

    return data.imageUrl || data.rawUrl;
}

async function uploadToCatbox(fileBlob: Blob, filename: string): Promise<string> {
    const formData = new FormData();
    formData.append("reqtype", "fileupload");
    formData.append("fileToUpload", fileBlob, filename);

    const proxiedUrl = `${CORS_PROXY}?url=${encodeURIComponent("https://catbox.moe/user/api.php")}`;
    const response = await fetch(proxiedUrl, {
        method: "POST",
        body: formData
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Upload failed: ${response.status} ${text}`);
    }

    const text = (await response.text()).trim();
    if (!text) {
        throw new Error("No URL returned from upload");
    }

    return text;
}

async function uploadTo0x0(fileBlob: Blob, filename: string): Promise<string> {
    const formData = new FormData();
    formData.append("file", fileBlob, filename);

    const proxiedUrl = `${CORS_PROXY}?url=${encodeURIComponent("https://0x0.st")}`;
    const response = await fetch(proxiedUrl, {
        method: "POST",
        body: formData
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Upload failed: ${response.status} ${text}`);
    }

    const text = (await response.text()).trim();
    if (!text) {
        throw new Error("No URL returned from upload");
    }

    return text;
}

async function uploadToLitterbox(fileBlob: Blob, filename: string): Promise<string> {
    const formData = new FormData();
    formData.append("reqtype", "fileupload");
    formData.append("time", settings.store.litterboxExpiry || "24h");
    formData.append("fileToUpload", fileBlob, filename);

    const proxiedUrl = `${CORS_PROXY}?url=${encodeURIComponent("https://litterbox.catbox.moe/resources/internals/api.php")}`;
    const response = await fetch(proxiedUrl, {
        method: "POST",
        body: formData
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Upload failed: ${response.status} ${text}`);
    }

    const text = (await response.text()).trim();
    if (!text) {
        throw new Error("No URL returned from upload");
    }

    return text;
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

        let blob: Blob;
        let contentType: string;

        if (Native) {
            const res = await Native.fetchFile(fetchUrl);
            if (res.success && res.data) {
                contentType = res.contentType || "";
                blob = new Blob([res.data], { type: contentType });
            } else {
                const response = await fetch(fetchUrl);
                if (!response.ok) {
                    throw new Error(`Failed to fetch file: ${response.status}`);
                }
                contentType = response.headers.get("content-type") || "";
                blob = await response.blob();
            }
        } else {
            const response = await fetch(fetchUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch file: ${response.status}`);
            }

            contentType = response.headers.get("content-type") || "";
            blob = await response.blob();
        }

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
            case ServiceType.EZHOST:
                uploadedUrl = await uploadToEzHost(typedBlob, filename);
                break;
            case ServiceType.CATBOX:
                uploadedUrl = await uploadToCatbox(typedBlob, filename);
                break;
            case ServiceType.ZEROX0:
                uploadedUrl = await uploadTo0x0(typedBlob, filename);
                break;
            case ServiceType.LITTERBOX:
                uploadedUrl = await uploadToLitterbox(typedBlob, filename);
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
