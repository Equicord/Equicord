/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { showNotification } from "@api/Notifications";

import { getAIProviders, settings } from "./settings";

const notified = new Set<string>();

export class InvalidApiKeyError extends Error {}

export function resetCredentialWarning(id: string) {
    notified.delete(id);
}

export function clearCredentialWarnings() {
    notified.clear();
}

export function notifyInvalidApiKey(id: string, key: string) {
    const providers = getAIProviders();
    for (const previousId of notified)
        if (previousId !== "deeplApiKey" && previousId !== "kagiSession" && !providers.some(provider => provider.id === previousId)) notified.delete(previousId);
    const provider = providers.find(entry => entry.id === id);
    const currentKey = id === "deeplApiKey" || id === "kagiSession" ? settings.store[id] : provider?.apiKey;
    if (currentKey !== key || notified.has(id)) return;

    notified.add(id);
    const name = id === "deeplApiKey" ? "DeepL" : id === "kagiSession" ? "Kagi" : provider?.name;
    showNotification({
        title: "Translate credentials need updating",
        body: `${name} rejected your API key or session. It may have expired. Click to update it.`,
        onClick: () => { import("./AISettings").then(({ openCredentialEditor }) => openCredentialEditor(id)); }
    });
}
