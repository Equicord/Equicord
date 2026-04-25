/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { existsSync, lstatSync, mkdirSync, readdirSync, renameSync, rmdirSync, statSync, unlinkSync, writeFileSync } from "original-fs";
import { basename, dirname, join } from "path";

const STUB_PACKAGE = JSON.stringify({ name: "discord", main: "index.js" });
const VERSION_PREFIX = "app-";

const makeStubIndex = (patcherPath: string) =>
    `require(${JSON.stringify(patcherPath)});`;

/** `_app.asar` next to `app.asar` marks any patched install. */
export const isAlreadyPatched = (resources: string) =>
    existsSync(join(resources, "_app.asar"));

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
export const patchResourcesDir = (resources: string, patcherJsPath: string): boolean => {
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
            const indexPath = join(app, "index.js");
            const pkgPath = join(app, "package.json");
            if (existsSync(indexPath)) unlinkSync(indexPath);
            if (existsSync(pkgPath)) unlinkSync(pkgPath);
            rmdirSync(app);
        });

        writeFileSync(join(app, "package.json"), STUB_PACKAGE);
        writeFileSync(join(app, "index.js"), makeStubIndex(patcherJsPath));
        return true;
    } catch (err) {
        for (let i = undo.length - 1; i >= 0; i--) {
            try {
                undo[i]();
            } catch (cleanupErr) {
                console.error("[Equicord] Rollback step failed", cleanupErr);
            }
        }
        throw err;
    }
};

const parsePart = (s: string) => parseInt(s, 10) || 0;

const isNewer = ($new: string, old: string): boolean => {
    const newParts = $new.slice(VERSION_PREFIX.length).split(".").map(parsePart);
    const oldParts = old.slice(VERSION_PREFIX.length).split(".").map(parsePart);
    const len = Math.max(newParts.length, oldParts.length);
    for (let i = 0; i < len; i++) {
        const n = newParts[i] ?? 0;
        const o = oldParts[i] ?? 0;
        if (n > o) return true;
        if (n < o) return false;
    }
    return false;
};

/**
 * find the newest sibling `app-VERSION` directory's `resources/` path.
 *
 * squirrel-only layout. returns `null` on non-win32 platforms, or when
 * the running process is already in the newest sibling.
 */
export const findStaleSibling = (currentExeDir: string): string | null => {
    if (process.platform !== "win32") return null;

    const discordPath = dirname(currentExeDir);
    const currentVersion = basename(currentExeDir);

    let latest = currentVersion;
    try {
        for (const name of readdirSync(discordPath)) {
            if (!name.startsWith(VERSION_PREFIX)) continue;
            let isDir = false;
            try {
                isDir = statSync(join(discordPath, name)).isDirectory();
            } catch (statErr) {
                console.error("[Equicord] Skipping unreadable sibling", name, statErr);
                continue;
            }
            if (!isDir) continue;
            if (isNewer(name, latest)) latest = name;
        }
    } catch (err) {
        console.error("[Equicord] Failed to scan for sibling versions", err);
        return null;
    }

    if (latest === currentVersion) return null;
    return join(discordPath, latest, "resources");
};
