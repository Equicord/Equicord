/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export enum ServiceType {
    ZIPLINE = "zipline",
    NEST = "nest"
}

export const serviceLabels: Record<ServiceType, string> = {
    [ServiceType.ZIPLINE]: "Zipline",
    [ServiceType.NEST]: "Nest"
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
