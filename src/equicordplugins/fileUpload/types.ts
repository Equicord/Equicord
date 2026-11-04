/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export enum ServiceType {
    ZIPLINE = "zipline",
    NEST = "nest",
    EZHOST = "ezhost",
    ENCRYPTINGHOST = "encryptinghost",
    S3 = "s3",
    CATBOX = "catbox",
    ZEROX0 = "0x0",
    LITTERBOX = "litterbox",
    SHAREX = "sharex",
    GOFILE = "gofile",
    TMPFILES = "tmpfiles",
    BUZZHEAVIER = "buzzheavier",
    TEMPSH = "tempsh",
    FILEBIN = "filebin",
    PIXELVAULT = "pixelvault",
    PIXELDRAIN = "pixeldrain",
    WEBDAV = "webdav"
}

export const serviceLabels: Record<ServiceType, string> = {
    [ServiceType.ZIPLINE]: "Zipline",
    [ServiceType.NEST]: "Nest",
    [ServiceType.EZHOST]: "E-Z Host",
    [ServiceType.ENCRYPTINGHOST]: "Encrypting.host",
    [ServiceType.S3]: "S3-Compatible",
    [ServiceType.CATBOX]: "Catbox",
    [ServiceType.ZEROX0]: "0x0.st",
    [ServiceType.LITTERBOX]: "Litterbox",
    [ServiceType.SHAREX]: "ShareX Custom Uploader",
    [ServiceType.GOFILE]: "GoFile",
    [ServiceType.TMPFILES]: "tmpfiles.org",
    [ServiceType.BUZZHEAVIER]: "buzzheavier.com",
    [ServiceType.TEMPSH]: "temp.sh",
    [ServiceType.FILEBIN]: "filebin.net",
    [ServiceType.PIXELVAULT]: "PixelVault",
    [ServiceType.PIXELDRAIN]: "PixelDrain",
    [ServiceType.WEBDAV]: "WebDAV"
};

export const fallbackServiceOrder: ServiceType[] = [
    ServiceType.ZIPLINE,
    ServiceType.EZHOST,
    ServiceType.NEST,
    ServiceType.ENCRYPTINGHOST,
    ServiceType.S3,
    ServiceType.CATBOX,
    ServiceType.ZEROX0,
    ServiceType.LITTERBOX,
    ServiceType.GOFILE,
    ServiceType.TMPFILES,
    ServiceType.BUZZHEAVIER,
    ServiceType.TEMPSH,
    ServiceType.FILEBIN,
    ServiceType.PIXELVAULT,
    ServiceType.PIXELDRAIN,
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

export type NativeRequestBody =
    | { type: "raw"; contentType?: string; data: ArrayBuffer; }
    | { type: "text"; text: string; }
    | { type: "multipart"; fields: [string, string][]; file: { field: string; filename: string; contentType?: string; data: ArrayBuffer; }; fileIndex?: number; };

export interface NativeRequestOptions {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: NativeRequestBody;
    timeoutMs?: number;
}

export interface NativeRequestResult {
    ok: boolean;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    text: string;
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
