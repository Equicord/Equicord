/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { existsSync, lstatSync, mkdirSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from "original-fs";
import { basename, dirname, join } from "path";

const STUB_PACKAGE = JSON.stringify({ name: "discord", main: "index.js" });

function makeStubIndex(patcherPath: string) {
    return `require(${JSON.stringify(patcherPath)});`;
}

/** `_app.asar` next to `app.asar` marks any patched install. */
export function isAlreadyPatched(resources: string) {
    return existsSync(join(resources, "_app.asar"));
}

/**
 * apply the folder-shim patch to a discord `resources/` directory.
 *
 * renames vanilla `app.asar` to `_app.asar`, creates an `app/` folder
 * whose `index.js` requires the given patcher script. electron prefers
 * the folder over the asar of the same name and loads it first.
 *
 * idempotent. returns `false` if the directory is already patched or
 * has no vanilla `app.asar`. throws on partial failure after rolling
 * back any disk changes already made.
 */
export function patchResourcesDir(resources: string, patcherJsPath: string): boolean {
    const app = join(resources, "app.asar");
    const _app = join(resources, "_app.asar");

    if (isAlreadyPatched(resources)) return false;
    if (!existsSync(app)) return false;
    try {
        if (lstatSync(app).isDirectory()) return false;
    } catch {
        return false;
    }

    const undo: Array<() => void> = [];
    try {
        renameSync(app, _app);
        undo.push(() => renameSync(_app, app));

        mkdirSync(app);
        undo.push(() => {
            try {
                const indexPath = join(app, "index.js");
                const pkgPath = join(app, "package.json");
                if (existsSync(indexPath)) unlinkSync(indexPath);
                if (existsSync(pkgPath)) unlinkSync(pkgPath);
                require("original-fs").rmdirSync(app);
            } catch {
                /* eat it */
            }
        });

        writeFileSync(join(app, "package.json"), STUB_PACKAGE);
        writeFileSync(join(app, "index.js"), makeStubIndex(patcherJsPath));
        return true;
    } catch (err) {
        for (let i = undo.length - 1; i >= 0; i--) {
            try { undo[i](); } catch { /* eat this too */ }
        }
        throw err;
    }
}

function isNewer($new: string, old: string) {
    const newParts = $new.slice(4).split(".").map(Number);
    const oldParts = old.slice(4).split(".").map(Number);
    const len = Math.max(newParts.length, oldParts.length);
    for (let i = 0; i < len; i++) {
        const n = newParts[i] ?? 0;
        const o = oldParts[i] ?? 0;
        if (n > o) return true;
        if (n < o) return false;
    }
    return false;
}

/**
 * find the newest sibling `app-VERSION` directory's `resources/` path.
 *
 * squirrel-only layout. returns `null` on non-win32 platforms, or when
 * the running process is already in the newest sibling.
 */
export function findStaleSibling(currentExeDir: string): string | null {
    if (process.platform !== "win32") return null;

    const discordPath = dirname(currentExeDir);
    const currentVersion = basename(currentExeDir);

    let latest = currentVersion;
    try {
        for (const name of readdirSync(discordPath)) {
            if (!name.startsWith("app-")) continue;
            try {
                if (!statSync(join(discordPath, name)).isDirectory()) continue;
            } catch { continue; }
            if (isNewer(name, latest)) latest = name;
        }
    } catch { return null; }

    if (latest === currentVersion) return null;
    return join(discordPath, latest, "resources");
}
