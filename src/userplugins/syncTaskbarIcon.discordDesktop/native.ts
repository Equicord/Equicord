/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BrowserWindow, type IpcMainInvokeEvent, nativeImage } from "electron";
import { dirname, join } from "path";

const discordOrigin = /^https:\/\/(?:(?:canary|ptb)\.)?discord\.com$/;
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export function setWindowIcon(event: IpcMainInvokeEvent, png: ArrayBuffer | null): boolean {
    if (process.platform !== "win32" || !IS_DISCORD_DESKTOP || event.sender.isDestroyed()) return false;

    const frame = event.senderFrame;
    if (!frame || frame !== event.sender.mainFrame || !discordOrigin.test(frame.origin)) return false;

    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window || window.getParentWindow()) return false;

    try {
        if (png === null) {
            const icon = nativeImage.createFromPath(join(dirname(process.execPath), "app.ico"));
            if (icon.isEmpty()) return false;
            window.setIcon(icon);
            return true;
        }

        if (!(png instanceof ArrayBuffer) || png.byteLength < 33 || png.byteLength > 128 * 1024) return false;

        const bytes = Buffer.from(png);
        if (!bytes.subarray(0, 8).equals(pngSignature)
            || bytes.toString("ascii", 12, 16) !== "IHDR"
            || bytes.readUInt32BE(16) !== 128 || bytes.readUInt32BE(20) !== 128) return false;

        const icon = nativeImage.createFromBuffer(bytes);
        if (icon.isEmpty()) return false;
        window.setIcon(icon);
        return true;
    } catch {
        return false;
    }
}
