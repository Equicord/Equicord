/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { isObject } from "@utils/misc";
import type { PluginNative } from "@utils/types";
import { User } from "@vencord/discord-types";
import { Constants, RestAPI, showToast, SnowflakeUtils, Toasts } from "@webpack/common";

const Native = VencordNative.pluginHelpers.ClipUpload as PluginNative<typeof import("./native")>;

const defaultFileName = "clip.mp4";
const compatibleExtensions = [".mp4", ".m4v"];
const uploadAbortControllers = new Set<AbortController>();

export interface ClipMetadata {
    name?: string;
    applicationId?: unknown;
    createdAt?: number | string | Date;
    users?: User[];
    remoteClipId?: string | number;
    eventsTimeline?: any;
}

export interface ClipUploadOptions {
    fileName: string;
    participants: string[];
    title: string;
    spoiler: boolean;
    remix: boolean;
    thumbnail: boolean;
    createdAt: string;
    message: string;
    channelId: string;
    applicationId?: string;
    remoteClipId?: string;
    eventsTimeline?: unknown;
}

interface AttachmentUploadResponse {
    attachments?: Array<{
        upload_url: string;
        upload_filename: string;
    }>;
}

interface RestResponse {
    ok?: boolean;
    body?: unknown;
    text?: string;
}

export function getString(value: unknown) {
    return typeof value === "string" ? value : undefined;
}

export function abortActiveClipUploads() {
    for (const controller of uploadAbortControllers) {
        controller.abort();
    }
    uploadAbortControllers.clear();
}

export function getClipTitleFromName(name: string) {
    const extensionStart = name.lastIndexOf(".");
    return extensionStart > 0 ? name.slice(0, extensionStart) : name;
}

export function getDefaultClipTitle(clip?: ClipMetadata | null) {
    return typeof clip?.name === "string" ? clip.name.trim() : "";
}

export function getClipCreatedAt(clip?: ClipMetadata | null) {
    const { createdAt } = clip ?? {};

    if (createdAt instanceof Date) return createdAt.toISOString();
    if (typeof createdAt === "number") return new Date(createdAt).toISOString();
    if (typeof createdAt === "string") {
        const date = new Date(createdAt);
        if (!Number.isNaN(date.getTime())) return date.toISOString();
    }

    return new Date().toISOString();
}

export function getParticipantIds(clip?: ClipMetadata | null): string[] {
    if (!Array.isArray(clip?.users)) return [];

    return clip.users.flatMap(user => {
        if (typeof user === "string") return user;
        if (isObject(user) && typeof user.id === "string") return user.id;
        return [];
    });
}

export function isValidDate(value: string) {
    return Boolean(value.trim()) && !Number.isNaN(new Date(value).getTime());
}

export function getDefaultFileName() {
    return defaultFileName;
}

function getFileExtension(fileName: string) {
    return fileName.match(/\.[a-z0-9]+$/i)?.[0].toLowerCase() ?? ".mp4";
}

async function readStampedVideoFile(token: string, name: string, type: string) {
    const tmpToken = await Native.createTempVideoFile(token);
    if (!tmpToken) throw new Error("Couldn't prepare the selected file.");

    try {
        const data = await Native.readVideoFile(tmpToken);
        if (!data) throw new Error("Couldn't read the selected file.");

        return new File([new Uint8Array(data)], name, { type });
    } finally {
        await Native.deleteTempVideoFile(tmpToken);
    }
}

export async function pickClipFile() {
    const picked = await Native.chooseVideoFile();
    if (!picked) return null;

    return readStampedVideoFile(picked.token, picked.name, picked.type);
}

function isCompatibleClipFile(file: File) {
    return file.type === "video/mp4" || compatibleExtensions.includes(getFileExtension(file.name));
}

function prepareClipFile(file: File, fileName: string) {
    if (isCompatibleClipFile(file)) {
        return new File([file], fileName, { type: file.type || "video/mp4" });
    }
    throw new Error("This file is not compatible. Use an MP4 clip with H.264 video and AAC audio.");
}

function parseAttachmentUploadResponse(response: RestResponse): AttachmentUploadResponse {
    if (isObject(response.body)) return response.body as AttachmentUploadResponse;
    return parseJSON<AttachmentUploadResponse>(response.text) ?? {};
}

async function reserveClipUpload(options: ClipUploadOptions, file: File) {
    const response = await RestAPI.post({
        url: Constants.Endpoints.MESSAGE_CREATE_ATTACHMENT_UPLOAD(options.channelId),
        body: {
            content: options.message,
            files: [{
                filename: options.fileName,
                file_size: file.size,
                id: "0",
                is_clip: true,
                is_spoiler: options.spoiler,
                is_remix: options.remix,
                is_thumbnail: options.thumbnail,
                title: options.title,
                application_id: options.applicationId,
                clip_created_at: options.createdAt,
                clip_participant_ids: options.participants,
                clip_remote_id: options.remoteClipId,
                clip_events_timeline: options.eventsTimeline,
                original_content_type: file.type || "video/mp4"
            }]
        }
    }) as RestResponse;

    return parseAttachmentUploadResponse(response).attachments?.[0];
}

export async function uploadClipFile(file: File, options: ClipUploadOptions) {
    let uploadAbortController: AbortController | undefined;

    try {
        showToast("Checking clip file.", Toasts.Type.MESSAGE);

        const uploadFile = await prepareClipFile(file, options.fileName);
        const attachment = await reserveClipUpload(options, uploadFile);
        if (!attachment) throw new Error("Discord did not return an upload slot.");

        uploadAbortController = new AbortController();
        uploadAbortControllers.add(uploadAbortController);

        const uploadResponse = await fetch(attachment.upload_url, {
            method: "PUT",
            body: uploadFile,
            signal: uploadAbortController.signal,
            referrer: "https://discord.com/",
            referrerPolicy: "strict-origin-when-cross-origin",
            mode: "cors",
            credentials: "omit"
        });

        if (!uploadResponse.ok) throw new Error("Upload failed.");

        const messageResponse = await RestAPI.post({
            url: Constants.Endpoints.MESSAGES(options.channelId),
            body: {
                content: options.message,
                nonce: SnowflakeUtils.fromTimestamp(Date.now()),
                channel_id: options.channelId,
                sticker_ids: [],
                type: 0,
                attachments: [{
                    id: "0",
                    filesize: uploadFile.size,
                    filename: options.fileName,
                    uploaded_filename: attachment.upload_filename,
                    is_clip: true,
                    is_spoiler: options.spoiler,
                    is_remix: options.remix,
                    is_thumbnail: options.thumbnail,
                    title: options.title,
                    application_id: options.applicationId,
                    clip_created_at: options.createdAt,
                    clip_participant_ids: options.participants,
                    clip_remote_id: options.remoteClipId,
                    clip_events_timeline: options.eventsTimeline
                }]
            }
        }) as RestResponse;

        if (messageResponse.ok === false) throw messageResponse;

        showToast("Clip uploaded.", Toasts.Type.SUCCESS);
        return true;
    } catch (error) {
        showToast(getErrorMessage(error), Toasts.Type.FAILURE);
        return false;
    } finally {
        if (uploadAbortController) uploadAbortControllers.delete(uploadAbortController);
    }
}

export function getErrorMessage(error: unknown): string {
    console.error(error);
    if (error instanceof DOMException && error.name === "AbortError") return "Upload canceled.";
    if (error instanceof Error) return error.message;
    return "Failed to upload clip.";
}

function parseJSON<T>(text?: string): T | null {
    if (!text) return null;
    try {
        return JSON.parse(text) as T;
    } catch {
        return null;
    }
}
