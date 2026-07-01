/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

let previewActive = false;
let previewGuildId: string | undefined;

export function setProfileSetsPreviewContext(guildId?: string) {
    previewActive = true;
    previewGuildId = guildId;
}

export function clearProfileSetsPreviewContext() {
    previewActive = false;
    previewGuildId = undefined;
}

export function getProfileSetsPreviewContext() {
    return { active: previewActive, guildId: previewGuildId };
}
