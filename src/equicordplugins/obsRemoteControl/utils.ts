/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { PluginNative } from "@utils/types";

const Native = VencordNative.pluginHelpers["OBS Remote Control"] as PluginNative<typeof import("./native")>;

export async function isOBSRunning(): Promise<boolean> {
    const processes = await Native.getProcesses();
    if (processes instanceof Error) {
        throw processes;
    }
    const match = processes.match(/(?<=^|\\|\/|\s)(?:obs64\.exe)|(?:obs)(?=$|\s)/gim);
    return match !== null;
}

export function parseArgs(args: string): string[] {
    return args.split(/(--[^\s]+="[^"]+")|"([^"]+)"|'([^']+)'|([^\s]+)/).filter(e => typeof e === "string" && e.trim());
}
