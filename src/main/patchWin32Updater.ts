/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * fallback for `hostUpdateHook.ts`. scans for a newer squirrel sibling
 * `app-VERSION` directory on quit and re-applies the patch there.
 */

import { app } from "electron";
import { dirname, join } from "path";

import { findStaleSibling, patchResourcesDir } from "./applyHostPatch";

app.on("before-quit", () => {
    try {
        const stale = findStaleSibling(dirname(process.execPath));
        if (stale) patchResourcesDir(stale, join(__dirname, "patcher.js"));
    } catch (err) {
        console.error("[Equicord] Failed to repatch latest host update", err);
    }
});
