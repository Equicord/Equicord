/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Cooper/coopeeo, Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// This file is a type definition file for connection objects (and so it does cool auto-correct things on IDE's, because I like that).

export interface Connection {
    type: string,
    name: string,
    color: string,
    icon: ConnectionIcon,
    enabled: boolean,
    hasMetadata?: boolean,
    getPlatformUserUrl?: (e: object) => string,
    domains?: string[],
}

export interface ConnectionIcon {
    lightPNG: string,
    darkPNG: string,
    whitePNG: string,
    lightSVG: string,
    darkSVG: string,
    whiteSVG: string,
}


