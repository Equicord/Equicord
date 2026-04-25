/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * re-applies the equicord patch to a freshly installed discord host
 * version at the moment the native updater finishes writing it.
 *
 * hooks `discord_desktop_core.startup({ updater })` to capture the live
 * updater instance, listens for its `host-updated` event, and wraps
 * `startCurrentVersion` for the post-update relaunch handoff. both paths
 * are idempotent because `patchResourcesDir` checks for the `_app.asar`
 * marker before doing anything.
 *
 * targets discord's new updater code path. default on win32 and linux.
 * on darwin the new updater is opt-in via `USE_NEW_UPDATER`, so installs
 * using the legacy sparkle-style autoUpdater fall through to the normal
 * reinject flow on first post-update launch.
 */

import Module from "module";
import { basename, dirname, join, resolve as resolvePath, sep } from "path";

import { findStaleSibling, patchResourcesDir } from "./applyHostPatch";

interface DiscordVersions {
    current_host?: number[];
    current_modules?: Record<string, string>;
    last_successful_update?: unknown;
}

interface StartCurrentVersionOptions {
    allowObsoleteHost?: boolean;
}

interface DiscordBuildInfo {
    releaseChannel: string;
    version: string;
}

interface DiscordHostUpdater {
    committedHostVersion?: number[];
    rootPath?: string;
    on?(event: "host-updated", handler: () => void): void;
    queryCurrentVersionsSync?(): DiscordVersions;
    startCurrentVersion?(queryOptions?: object, options?: StartCurrentVersionOptions): Promise<void>;
    startCurrentVersionSync?(options?: StartCurrentVersionOptions): void;
}

interface DiscordUpdaterModule {
    getUpdater?(): DiscordHostUpdater | null | undefined;
    tryInitUpdater?(buildInfo: DiscordBuildInfo, repositoryUrl: string, useRustBspatch: boolean): boolean;
    __equicordTryInitWrapped?: boolean;
}

interface DiscordDesktopCoreStartupOpts {
    updater?: DiscordUpdaterModule;
    [key: string]: unknown;
}

interface DiscordDesktopCore {
    startup?(opts: DiscordDesktopCoreStartupOpts): void;
    __equicordStartupWrapped?: boolean;
}

const error = (...args: unknown[]) => console.error("[Equicord:HostUpdate]", ...args);

const hookedUpdaters = new WeakSet<DiscordHostUpdater>();
let hooked = false;

const getPatcherJsPath = () => join(__dirname, "patcher.js");

/**
 * resolve `resources/` for a given discord version directory.
 *
 * on darwin, extracts the bundle name (Discord.app, DiscordCanary.app,
 * DiscordPTB.app) from `process.execPath`. matches discord's own logic
 * in `common/updater.js#_getHostExePath`. iterates from the end so a
 * nested `.app` segment near the binary wins over an outer one.
 */
const resourcesPathFor = (versionDir: string): string => {
    if (process.platform !== "darwin") return join(versionDir, "resources");

    const segs = process.execPath.split(sep);
    for (let i = segs.length - 1; i >= 0; i--) {
        if (segs[i].endsWith(".app")) {
            return join(versionDir, segs[i], "Contents", "Resources");
        }
    }
    return join(versionDir, "Contents", "Resources");
};

/**
 * resolve the version dir the current process runs from.
 *
 * on darwin, execPath sits four levels deep inside the version dir,
 * at `<versionDir>/<AppName>.app/Contents/MacOS/<bin>`.
 */
const currentVersionDir = (): string => {
    if (process.platform === "darwin") {
        return resolvePath(process.execPath, "..", "..", "..", "..");
    }
    return dirname(process.execPath);
};

/**
 * resolve the new host version array.
 *
 * `committedHostVersion` is only populated after `_startCurrentVersionInner`
 * runs, so during `host-updated` we have to query the native side
 * directly to get fresh state.
 */
const resolveCommittedVersion = (updater: DiscordHostUpdater): number[] | undefined => {
    if (Array.isArray(updater.committedHostVersion)) return updater.committedHostVersion;
    try {
        const versions = updater.queryCurrentVersionsSync?.();
        if (Array.isArray(versions?.current_host)) return versions.current_host;
    } catch (err) {
        error("queryCurrentVersionsSync failed", err);
    }
    return undefined;
};

const retainEquicord = (updater: DiscordHostUpdater, reason: string) => {
    try {
        const committed = resolveCommittedVersion(updater);
        const { rootPath } = updater;

        if (!committed || !rootPath) {
            /*
             * updater state unavailable. fall back to filesystem scan
             * on win32 only because the sibling layout is squirrel
             * specific.
             */
            if (process.platform !== "win32") return;
            const stale = findStaleSibling(dirname(process.execPath));
            if (stale) patchResourcesDir(stale, getPatcherJsPath());
            return;
        }

        const versionDir = join(rootPath, `app-${committed.join(".")}`);
        if (resolvePath(versionDir) === resolvePath(currentVersionDir())) return;

        patchResourcesDir(resourcesPathFor(versionDir), getPatcherJsPath());
    } catch (err) {
        error(`[${reason}] retain failed:`, err);
    }
};

const attachToUpdater = (updater: DiscordHostUpdater | null | undefined) => {
    if (!updater || hookedUpdaters.has(updater)) return;
    try {
        hookedUpdaters.add(updater);
    } catch (err) {
        error("Failed to track updater instance", err);
        return;
    }

    updater.on?.("host-updated", () => retainEquicord(updater, "host-updated"));

    /*
     * wrap the post-update relaunch entrypoints. retain runs after the
     * original so `committedHostVersion` is freshly populated by
     * `_startCurrentVersionInner`. relaunch is scheduled via
     * `app.once("will-quit", spawn)` then `app.quit()`, so the patch
     * still finishes before the new exe is spawned.
     */
    const sync = updater.startCurrentVersionSync;
    if (typeof sync === "function") {
        const bound = sync.bind(updater);
        updater.startCurrentVersionSync = (options?: StartCurrentVersionOptions) => {
            bound(options);
            try { retainEquicord(updater, "startCurrentVersionSync"); } catch (e) { error(e); }
        };
    }
    const async_ = updater.startCurrentVersion;
    if (typeof async_ === "function") {
        const bound = async_.bind(updater);
        updater.startCurrentVersion = async (queryOptions?: object, options?: StartCurrentVersionOptions) => {
            await bound(queryOptions, options);
            try { retainEquicord(updater, "startCurrentVersion"); } catch (e) { error(e); }
        };
    }
};

const wrapStartup = (coreExports: DiscordDesktopCore | null | undefined) => {
    if (!coreExports?.startup || coreExports.__equicordStartupWrapped) return;
    coreExports.__equicordStartupWrapped = true;

    const origStartup = coreExports.startup;
    coreExports.startup = function (opts, ...rest) {
        try {
            const updaterModule = opts?.updater;
            const inst = updaterModule?.getUpdater?.();
            if (inst) {
                attachToUpdater(inst);
            } else if (typeof updaterModule?.tryInitUpdater === "function" && !updaterModule.__equicordTryInitWrapped) {
                /*
                 * updater not yet constructed at startup time. wrap the
                 * factory so we attach once vanilla creates it.
                 */
                updaterModule.__equicordTryInitWrapped = true;
                const origTry = updaterModule.tryInitUpdater.bind(updaterModule);
                updaterModule.tryInitUpdater = (buildInfo, repositoryUrl, useRustBspatch) => {
                    const ok = origTry(buildInfo, repositoryUrl, useRustBspatch);
                    try { attachToUpdater(updaterModule.getUpdater?.()); } catch (e) { error(e); }
                    return ok;
                };
            }
        } catch (e) {
            error("wrap updater failed:", e);
        }
        return origStartup.call(this, opts, ...rest);
    };
};

export const installHostUpdateHook = () => {
    if (hooked) return;
    hooked = true;

    /*
     * intercept `require` to catch the first `discord_desktop_core` load
     * before vanilla bootstrap calls its `startup`. normalise separators
     * so absolute requires resolve correctly on windows. once we have
     * wrapped startup we restore the original require to avoid taxing
     * every subsequent require call.
     */
    const origRequire = Module.prototype.require;
    Module.prototype.require = function (this: Module, id: string) {
        const result = origRequire.call(this, id);
        if (!id.includes("discord_desktop_core")) return result;

        if (basename(id.replace(/\\/g, "/")) === "discord_desktop_core") {
            try { wrapStartup(result?.default ?? result); } catch (e) { error(e); }
            Module.prototype.require = origRequire;
        }
        return result;
    } as typeof Module.prototype.require;
};
