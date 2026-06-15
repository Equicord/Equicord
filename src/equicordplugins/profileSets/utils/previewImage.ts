/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IconUtils } from "@webpack/common";

export function normalizeImageValue(value: unknown): string | null {
    if (typeof value === "string") return value;
    if (value && typeof value === "object" && "imageUri" in value) {
        const { imageUri } = value as { imageUri: unknown; };
        return typeof imageUri === "string" ? imageUri : null;
    }
    return null;
}

export function resolvePendingAvatarUrl(
    image: unknown,
    userId: string,
    guildId?: string,
    size = 256
): string | null {
    if (image == null) return null;

    const uri = normalizeImageValue(image);
    if (uri?.startsWith("data:") || uri?.startsWith("http")) return uri;

    if (typeof image === "string" && image.length > 0) {
        const canAnimate = image.startsWith("a_");
        if (guildId) {
            return IconUtils.getGuildMemberAvatarURLSimple?.({
                guildId,
                userId,
                avatar: image,
                canAnimate,
                size
            }) ?? null;
        }
        return `https://cdn.discordapp.com/avatars/${userId}/${image}.${canAnimate ? "gif" : "png"}?size=${size}`;
    }

    return uri;
}
