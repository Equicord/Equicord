/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { spawn } from "node:child_process";
import { release } from "node:os";
import { join } from "node:path";

import { RendererSettings } from "@main/settings";
import { app, BrowserWindow, IpcMainInvokeEvent } from "electron";

const originals = new Map<BrowserWindow, boolean>();
const errors = new Map<BrowserWindow, string>();
const cleanup = new WeakSet<BrowserWindow>();
const activity = new Map<BrowserWindow, { sharing: boolean; streamerMode: boolean; }>();
const supported = process.platform === "win32" && Number(release().split(".")[2]) >= 19041;

function readAffinity(script: string) {
    return new Promise<number>((resolve, reject) => {
        const child = spawn(join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe"),
            ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")],
            { windowsHide: true, timeout: 4000, stdio: ["ignore", "pipe", "ignore"] });
        let output = "";
        child.stdout.setEncoding("utf8");
        child.stdout.on("data", (chunk: string) => {
            output += chunk;
            if (output.length > 4096) child.kill();
        });
        child.once("error", reject);
        child.once("close", code => {
            if (code !== 0 || output.length > 4096) reject(new Error("Capture verification failed."));
            else resolve(Number(output.trim()));
        });
    });
}

function enabled() {
    const options = RendererSettings.store.plugins?.PrivateStreaming;
    return options?.enabled === true && (options.protectWindow ?? options.viewerOnly ?? true) === true
        && (options.activation === "always" || Array.from(activity.values()).some(
            state => state.sharing || (options.activation === "streamer" && state.streamerMode)
        ));
}

function watchWindow(window: BrowserWindow) {
    if (cleanup.has(window)) return;
    cleanup.add(window);
    window.on("show", synchronize);
    window.once("ready-to-show", synchronize);
    window.once("closed", () => {
        originals.delete(window);
        errors.delete(window);
        activity.delete(window);
        synchronize();
    });
    window.webContents.on("render-process-gone", () => {
        activity.delete(window);
        synchronize();
    });
}

function applyProtection(window: BrowserWindow, protect: boolean) {
    if (window.isDestroyed() || (!protect && !originals.has(window))) return;
    try {
        if (!originals.has(window)) originals.set(window, window.isContentProtected());
        watchWindow(window);
        const value = protect || originals.get(window) === true;
        if (window.isContentProtected() !== value) window.setContentProtection(value);
        if (window.isContentProtected() !== value) throw new Error("The window did not accept capture protection.");
        errors.delete(window);
        if (!protect) originals.delete(window);
    } catch {
        errors.set(window, protect
            ? "Windows could not protect one of Discord's windows from capture."
            : "Windows could not restore a window's previous capture setting. Fully restart Discord.");
    }
}

function synchronize() {
    if (!supported || !app.isReady()) return;
    if (RendererSettings.store.plugins?.PrivateStreaming?.enabled !== true) activity.clear();
    const protect = enabled();
    for (const window of BrowserWindow.getAllWindows()) applyProtection(window, protect);
}

app.on("browser-window-created", (_event, window) => {
    if (supported && enabled()) applyProtection(window, true);
});
RendererSettings.addGlobalChangeListener(synchronize);
synchronize();

export async function getProtectionStatus(event: IpcMainInvokeEvent, sharing?: boolean, streamerMode?: boolean) {
    const owner = BrowserWindow.fromWebContents(event.sender);
    if (!owner || owner.isDestroyed() || event.senderFrame !== event.sender.mainFrame) {
        return { version: 6, enabled: false, protected: false, error: "Capture protection is available only from a Discord window." };
    }
    if (sharing !== undefined || streamerMode !== undefined) {
        if (typeof sharing !== "boolean" || typeof streamerMode !== "boolean")
            return { version: 6, enabled: false, protected: false, error: "Invalid streaming activity." };
        watchWindow(owner);
        activity.set(owner, { sharing, streamerMode });
    }
    synchronize();
    let protectedByWindows = false;
    let error = !supported && enabled() ? "Whole-window capture protection requires Windows 10 version 2004 or later."
        : errors.values().next().value;
    if (!error && enabled() && owner.isContentProtected()) {
        const handle = owner.getNativeWindowHandle();
        const hwnd = handle.length === 8 ? handle.readBigUInt64LE().toString() : handle.readUInt32LE().toString();
        const script = `$ErrorActionPreference='Stop'; Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class WindowCapture { [DllImport("user32.dll", SetLastError=true)] public static extern bool GetWindowDisplayAffinity(IntPtr hwnd, out uint affinity); }'; [uint32]$affinity=0; if (-not [WindowCapture]::GetWindowDisplayAffinity([IntPtr]${hwnd}, [ref]$affinity)) { throw 'Could not read capture protection.' }; $affinity`;
        try {
            protectedByWindows = await readAffinity(script) === 0x11;
            if (!protectedByWindows) error = "Windows did not confirm capture exclusion for this Discord window. This Electron build may not support it correctly.";
        } catch {
            error = "Could not verify Windows capture protection. Ordinary blur remains available.";
        }
    }
    return {
        version: 6,
        enabled: enabled(),
        protected: enabled() && !owner.isDestroyed() && owner.isContentProtected() && protectedByWindows,
        error
    };
}
