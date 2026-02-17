/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ShareXUploaderConfig } from "../types";

const JSON_TEMPLATE_REGEX = /\$json:([^$]+)\$|\{json:([^}]+)\}/g;
const RESPONSE_TEMPLATE_REGEX = /\$response\$|\{response\}/g;

function parseDestinationTypes(destinationType?: string): string[] {
    if (!destinationType) return [];

    return destinationType
        .split(",")
        .map(type => type.trim())
        .filter(Boolean);
}

function getNestedValue(data: unknown, path: string): unknown {
    const normalizedPath = path.replace(/\[(\d+)\]/g, ".$1");
    const segments = normalizedPath.split(".").filter(Boolean);

    let current: unknown = data;
    for (const segment of segments) {
        if (!current || typeof current !== "object" || !(segment in current)) {
            return undefined;
        }

        current = (current as Record<string, unknown>)[segment];
    }

    return current;
}

export function parseShareXConfig(configText: string): ShareXUploaderConfig {
    let parsed: unknown;
    const normalizedConfigText = configText.replace(/^\uFEFF/, "").trim();

    try {
        parsed = JSON.parse(normalizedConfigText);
    } catch {
        throw new Error("Invalid ShareX JSON");
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("ShareX config must be a JSON object");
    }

    const config = parsed as ShareXUploaderConfig;

    if (!config.RequestURL || typeof config.RequestURL !== "string") {
        throw new Error("ShareX RequestURL is required");
    }

    if (!isSupportedShareXDestination(config)) {
        throw new Error("ShareX DestinationType must include FileUploader or ImageUploader");
    }

    return config;
}

export function isSupportedShareXDestination(config: ShareXUploaderConfig): boolean {
    const destinationTypes = parseDestinationTypes(config.DestinationType);

    if (destinationTypes.length === 0) {
        return true;
    }

    return destinationTypes.includes("FileUploader") || destinationTypes.includes("ImageUploader");
}

export function resolveShareXTemplate(
    template: string | undefined,
    responseText: string,
    responseJson: unknown
): string | undefined {
    if (!template) return undefined;

    let output = template.trim();
    if (!output) return undefined;

    output = output.replace(RESPONSE_TEMPLATE_REGEX, responseText);
    output = output.replace(JSON_TEMPLATE_REGEX, (_, pathA: string, pathB: string) => {
        const path = pathA || pathB;
        const value = getNestedValue(responseJson, path);
        return value == null ? "" : String(value);
    });

    return output;
}
