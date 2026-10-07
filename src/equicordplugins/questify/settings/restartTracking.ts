/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { SettingsStore } from "@api/Settings";
import type { DefinedSettings, SettingsDefinition } from "@utils/types";
import { Alerts } from "@webpack/common";

type RestartTrackingSettings = Pick<DefinedSettings<SettingsDefinition>, "def" | "pluginName">;

interface RestartPromptOptions {
    onDecline?: () => void;
}

let restartDirty = false;
let restartListenerCleanup: (() => void) | undefined;

export function initializeRestartTracking(settings: RestartTrackingSettings): void {
    if (restartListenerCleanup) return;

    const prefix = `plugins.${settings.pluginName}`;
    function markRestartDirty(_value: unknown, path: string): void {
        const key = path.slice(prefix.length + 1).split(".")[0];
        if (settings.def[key]?.restartNeeded) restartDirty = true;
    }

    SettingsStore.addPrefixChangeListener(prefix, markRestartDirty);
    restartListenerCleanup = () => SettingsStore.removePrefixChangeListener(prefix, markRestartDirty);
}

export function disposeRestartTracking(): void {
    restartListenerCleanup?.();
    restartListenerCleanup = undefined;
}

export function setRestartDirty(dirty: boolean): void {
    restartDirty = dirty;
}

export function promptToRestartIfDirty({ onDecline }: RestartPromptOptions = {}): boolean {
    if (!restartDirty) {
        return false;
    }

    let didConfirm = false;
    let didDecline = false;

    function declineRestart(): void {
        if (didConfirm || didDecline) {
            return;
        }

        didDecline = true;

        if (onDecline) {
            setTimeout(onDecline, 0);
        }
    }

    Alerts.show({
        title: "Restart Required",
        body: "A change you've made to Questify's settings requires a restart.",
        confirmText: "Restart",
        cancelText: "Later",
        onConfirm: () => {
            didConfirm = true;
            location.reload();
        },
        onCancel: declineRestart,
        onCloseCallback: declineRestart,
    });

    return true;
}
