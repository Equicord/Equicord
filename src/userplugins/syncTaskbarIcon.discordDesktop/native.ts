/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";

import { app, BrowserWindow, type IpcMainInvokeEvent, nativeImage } from "electron";
import { basename, dirname, join } from "path";

const discordOrigin = /^https:\/\/(?:(?:canary|ptb)\.)?discord\.com$/;
const discordExecutable = /^Discord(?:Canary|PTB|Development)?$/;
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const iconSize = 128;

function saveIcon(png: Buffer) {
    const header = Buffer.alloc(22);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(1, 4);
    header[6] = header[7] = iconSize;
    header.writeUInt16LE(1, 10);
    header.writeUInt16LE(32, 12);
    header.writeUInt32LE(png.length, 14);
    header.writeUInt32LE(header.length, 18);

    const directory = join(app.getPath("userData"), "equicord-taskbar-icons");
    const hash = createHash("sha256").update(png).digest("hex");
    const iconPath = join(directory, `${hash}.ico`);
    mkdirSync(directory, { recursive: true });
    writeFileSync(iconPath, Buffer.concat([header, png]));
    return iconPath;
}

export function setWindowIcon(event: IpcMainInvokeEvent, png: ArrayBuffer | null): string | null {
    if (process.platform !== "win32" || !IS_DISCORD_DESKTOP || event.sender.isDestroyed()) {
        return "A live Windows Discord desktop renderer is required.";
    }

    const frame = event.senderFrame;
    if (!frame || frame !== event.sender.mainFrame || !discordOrigin.test(frame.origin)) {
        return "The request did not come from Discord's main frame.";
    }

    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window || window.getParentWindow()) return "Could not find Discord's top-level window.";

    const executable = basename(process.execPath, ".exe");
    if (!discordExecutable.test(executable)) return "Could not determine Discord's Windows app ID.";

    let iconPath = join(dirname(process.execPath), "app.ico");
    if (png !== null) {
        if (!(png instanceof ArrayBuffer) || png.byteLength < 33 || png.byteLength > 128 * 1024) {
            return "Invalid icon payload size or type.";
        }

        const bytes = Buffer.from(png);
        if (!bytes.subarray(0, 8).equals(pngSignature)
            || bytes.toString("ascii", 12, 16) !== "IHDR"
            || bytes.readUInt32BE(16) !== iconSize || bytes.readUInt32BE(20) !== iconSize) {
            return "Expected a 128 by 128 PNG icon.";
        }

        try {
            const image = nativeImage.createFromBuffer(bytes);
            if (image.isEmpty()) return "Electron could not decode the PNG icon.";
            iconPath = saveIcon(image.toPNG());
        } catch {
            return "Could not save the Windows icon resource.";
        }
    }

    try {
        const icon = nativeImage.createFromPath(iconPath);
        if (icon.isEmpty()) return "Electron could not load the Windows icon resource.";

        window.setAppDetails({ appId: `com.squirrel.${executable}.${executable}`, appIconPath: iconPath });
        window.setIcon(icon);
        return null;
    } catch {
        return "Electron rejected the window icon or taskbar details.";
    }
}
