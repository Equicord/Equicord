/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { showToast } from "@webpack/common";

import { promptToRestart } from "./promptToRestart";
import { useAwaiter, useForceUpdater } from "./react";

export function useCspPermission(url: string | undefined, directives: string[], callerName: string) {
    const [signal, forceUpdate] = useForceUpdater(true);
    const [isAllowed] = useAwaiter(
        async () => IS_WEB || !url || !URL.canParse(url) || VencordNative.csp.isDomainAllowed(url, directives),
        { fallbackValue: true, deps: [url, signal] }
    );

    const requestPermission = async () => {
        if (!url) return;

        const res = await VencordNative.csp.requestAddOverride(url, directives, callerName);
        if (res === "ok") {
            forceUpdate();
            promptToRestart("relaunch");
        } else if (res !== "cancelled") {
            showToast({ text: "Could not allow this domain.", variant: "critical" });
        }
    };

    return [isAllowed, requestPermission] as const;
}
