/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export enum ServiceType {
    ZIPLINE = "zipline",
    NEST = "nest",
    ENCRYPTINGHOST = "encryptinghost",
    S3 = "s3",
    CATBOX = "catbox",
    LITTERBOX = "litterbox",
    SHAREX = "sharex",
    WEBDAV = "webdav"
}

export const serviceLabels: Record<ServiceType, string> = {
    [ServiceType.ZIPLINE]: "Zipline",
    [ServiceType.NEST]: "Nest",
    [ServiceType.ENCRYPTINGHOST]: "Encrypting.host",
    [ServiceType.S3]: "S3-Compatible",
    [ServiceType.CATBOX]: "Catbox",
    [ServiceType.LITTERBOX]: "Litterbox",
    [ServiceType.SHAREX]: "ShareX Custom Uploader",
    [ServiceType.WEBDAV]: "WebDAV"
};

export const fallbackServiceOrder: ServiceType[] = [
    ServiceType.ZIPLINE,
    ServiceType.NEST,
    ServiceType.ENCRYPTINGHOST,
    ServiceType.S3,
    ServiceType.CATBOX,
    ServiceType.LITTERBOX,
    ServiceType.WEBDAV,
    ServiceType.SHAREX
];

export interface UploadResponse {
    files: {
        id: string;
        type: string;
        url: string;
    }[];
}

export interface NestUploadResponse {
    fileURL: string;
}

export interface NativeUploadResult {
    success: boolean;
    url?: string;
    error?: string;
}

export interface ShareXUploaderConfig {
    Version?: string;
    Name?: string;
    DestinationType?: string;
    RequestMethod?: string;
    RequestURL?: string;
    Headers?: Record<string, string | number | boolean>;
    Body?: string;
    FileFormName?: string;
    Arguments?: Record<string, string | number | boolean>;
    URL?: string;
    ErrorMessage?: string;
}
