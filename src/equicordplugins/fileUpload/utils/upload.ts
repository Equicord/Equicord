/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { settings } from "@equicordplugins/fileUpload/settings";
import { ServiceType, ShareXUploaderConfig, UploadResponse } from "@equicordplugins/fileUpload/types";
import { copyToClipboard } from "@utils/clipboard";
import { PluginNative } from "@utils/types";
import { showToast, Toasts } from "@webpack/common";

import { convertApngToGif } from "./apngToGif";
import { getExtensionFromBytes, getExtensionFromMime, getMimeFromExtension, getUrlExtension } from "./getMediaUrl";
import { isS3Configured, uploadToS3 } from "./s3";
import { parseShareXConfig, resolveShareXTemplate } from "./sharex";

const Native = IS_DISCORD_DESKTOP
    ? VencordNative.pluginHelpers.FileUpload as PluginNative<typeof import("../native")>
    : null;

const CORS_PROXY = "https://cors.keiran0.workers.dev"; // im hosting this on cloudflare workers so uptime and latency should be reliable

let isUploading = false;

function resolveShareXRequestValue(value: string | number | boolean, filename: string): string {
    return String(value)
        .replace(/\$filename\$/g, filename)
        .replace(/\{filename\}/g, filename);
}

function parseShareXConfigFromSettings(): ShareXUploaderConfig {
    const configText = settings.store.sharexConfig || "";
    if (!configText.trim()) {
        throw new Error("ShareX config is required");
    }

    return parseShareXConfig(configText);
}

async function uploadToShareX(fileBlob: Blob, filename: string): Promise<string> {
    const config = parseShareXConfigFromSettings();
    const method = (config.RequestMethod || "POST").toUpperCase();
    const requestUrl = config.RequestURL!.trim();
    const bodyType = (config.Body || "MultipartFormData").toLowerCase();

    const headers = new Headers();
    for (const [key, value] of Object.entries(config.Headers || {})) {
        headers.set(key, resolveShareXRequestValue(value, filename));
    }

    const buildArguments = () => {
        const args: Record<string, string> = {};
        for (const [key, value] of Object.entries(config.Arguments || {})) {
            args[key] = resolveShareXRequestValue(value, filename);
        }
        return args;
    };

    let body: BodyInit;

    if (bodyType === "multipartformdata" || bodyType === "formdata") {
        headers.delete("content-type");

        const formData = new FormData();
        const fileField = config.FileFormName || "file";
        formData.append(fileField, fileBlob, filename);

        const args = buildArguments();
        for (const [key, value] of Object.entries(args)) {
            formData.append(key, value);
        }

        body = formData;
    } else if (bodyType === "binary") {
        body = fileBlob;
    } else if (bodyType === "json") {
        if (!headers.has("content-type")) {
            headers.set("content-type", "application/json");
        }

        const payload = buildArguments();
        body = JSON.stringify(payload);
    } else {
        throw new Error(`Unsupported ShareX Body type: ${config.Body || "unknown"}`);
    }

    let response: Response;
    try {
        response = await fetch(requestUrl, { method, headers, body });
    } catch (error) {
        if (Native) {
            throw error;
        }

        const proxiedUrl = `${CORS_PROXY}?url=${encodeURIComponent(requestUrl)}`;
        response = await fetch(proxiedUrl, { method, headers, body });
    }

    const responseText = await response.text();
    let responseJson: unknown = null;
    try {
        responseJson = responseText ? JSON.parse(responseText) : null;
    } catch {
        responseJson = null;
    }

    if (!response.ok) {
        const configuredError = resolveShareXTemplate(config.ErrorMessage, responseText, responseJson);
        throw new Error(configuredError || `Upload failed: ${response.status} ${response.statusText}`);
    }

    const configuredUrl = resolveShareXTemplate(config.URL, responseText, responseJson)?.trim();
    const fallbackUrl = typeof responseJson === "object" && responseJson && "url" in responseJson
        ? String((responseJson as Record<string, unknown>).url || "")
        : responseText.trim();

    const resultUrl = configuredUrl || fallbackUrl;
    if (!resultUrl) {
        throw new Error("No URL returned from ShareX uploader");
    }

    return resultUrl;
}

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

    const data = await response.json() as { fileURL?: string; };

    if (data.fileURL) {
        return data.fileURL;
    }

    throw new Error("No URL returned from upload");
}

export function isConfigured(): boolean {
    const {
        serviceType,
        serviceUrl,
        ziplineToken,
        nestToken
    } = settings.store as {
        serviceType: ServiceType;
        serviceUrl?: string;
        ziplineToken?: string;
        nestToken?: string;
    };
    switch (serviceType) {
        case ServiceType.NEST:
            return Boolean(nestToken);
        case ServiceType.EZHOST:
            return Boolean((settings.store as { ezHostKey?: string; }).ezHostKey);
        case ServiceType.S3:
            return isS3Configured();
        case ServiceType.CATBOX:
            return true;
        case ServiceType.ZEROX0:
            return Boolean(Native);
        case ServiceType.LITTERBOX:
            return true;
        case ServiceType.SHAREX:
            try {
                parseShareXConfigFromSettings();
                return true;
            } catch {
                return false;
            }
        case ServiceType.ZIPLINE:
        default:
            return Boolean(serviceUrl && ziplineToken);
    }
}

async function uploadToEzHost(fileBlob: Blob, filename: string): Promise<string> {
    const { ezHostKey } = (settings.store as { ezHostKey?: string; });

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
    const { catboxUserhash } = settings.store;

    if (Native) {
        const result = await Native.uploadToCatbox(await fileBlob.arrayBuffer(), filename, catboxUserhash || undefined);
        if (!result.success || !result.url) throw new Error(result.error || "No URL returned from upload");
        return result.url;
    }

    const formData = new FormData();
    formData.append("reqtype", "fileupload");
    if (catboxUserhash) formData.append("userhash", catboxUserhash);
    formData.append("fileToUpload", fileBlob, filename);

    const response = await fetch(`${CORS_PROXY}?url=${encodeURIComponent("https://catbox.moe/user/api.php")}`, {
        method: "POST",
        body: formData
    });

    if (!response.ok) throw new Error(`Upload failed: ${response.status} ${await response.text()}`);
    const text = (await response.text()).trim();
    if (!text) throw new Error("No URL returned from upload");
    return text;
}

async function uploadTo0x0(fileBlob: Blob, filename: string): Promise<string> {
    if (!Native) {
        throw new Error("0x0.st uploads are only supported on the desktop client");
    }

    const arrayBuffer = await fileBlob.arrayBuffer();
    const result = await Native.uploadTo0x0(arrayBuffer, filename);

    if (!result.success) {
        throw new Error(result.error || "Upload failed");
    }

    if (!result.url) {
        throw new Error("No URL returned from upload");
    }

    return result.url;
}

async function uploadToLitterbox(fileBlob: Blob, filename: string): Promise<string> {
    const expiry = settings.store.litterboxExpiry || "24h";

    if (Native) {
        const result = await Native.uploadToLitterbox(await fileBlob.arrayBuffer(), filename, expiry);
        if (!result.success || !result.url) throw new Error(result.error || "No URL returned from upload");
        return result.url;
    }

    const formData = new FormData();
    formData.append("reqtype", "fileupload");
    formData.append("time", expiry);
    formData.append("fileToUpload", fileBlob, filename);

    const response = await fetch(`${CORS_PROXY}?url=${encodeURIComponent("https://litterbox.catbox.moe/resources/internals/api.php")}`, {
        method: "POST",
        body: formData
    });

    if (!response.ok) throw new Error(`Upload failed: ${response.status} ${await response.text()}`);
    const text = (await response.text()).trim();
    if (!text) throw new Error("No URL returned from upload");
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
            case ServiceType.S3:
                uploadedUrl = await uploadToS3(typedBlob, filename, Native);
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
            case ServiceType.SHAREX:
                uploadedUrl = await uploadToShareX(typedBlob, filename);
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
