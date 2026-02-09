/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export enum ServiceType {
    ZIPLINE = "zipline",
    NEST = "nest",
    EZHOST = "ezhost",
    CATBOX = "catbox",
    ZEROX0 = "0x0",
    LITTERBOX = "litterbox"
}

export const serviceLabels: Record<ServiceType, string> = {
    [ServiceType.ZIPLINE]: "Zipline",
    [ServiceType.NEST]: "Nest",
    [ServiceType.EZHOST]: "E-Z Host",
    [ServiceType.CATBOX]: "Catbox",
    [ServiceType.ZEROX0]: "0x0.st",
    [ServiceType.LITTERBOX]: "Litterbox"
};

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
