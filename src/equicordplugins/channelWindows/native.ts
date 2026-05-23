/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BrowserWindow, type IpcMainInvokeEvent, shell } from "electron";

const windows = new Map<string, BrowserWindow>();
const allowedDiscordOrigins = new Set([
    "https://canary.discord.com",
    "https://discord.com",
    "https://ptb.discord.com"
]);

export interface ConversationWindowOptions {
    autoHideMenuBar: boolean;
    backgroundColor: string;
    compactMode: boolean;
    devTools: boolean;
    focusExistingWindow: boolean;
    height: number;
    minHeight: number;
    minWidth: number;
    reuseExistingWindow: boolean;
    title: string;
    width: number;
}

const defaultOptions: ConversationWindowOptions = {
    autoHideMenuBar: true,
    backgroundColor: "#313338",
    compactMode: true,
    devTools: false,
    focusExistingWindow: true,
    height: 800,
    minHeight: 480,
    minWidth: 720,
    reuseExistingWindow: true,
    title: "Discord",
    width: 1100
};

const compactConversationCss = `
    body {
        overflow: hidden !important;
    }

    #app-mount {
        height: 100vh !important;
        width: 100vw !important;
    }

    nav[aria-label="Servers"],
    [data-list-id="guildsnav"],
    [aria-label="Private channels"],
    [aria-label="Channels"],
    [class*="guilds_"],
    [class*="sidebar_"],
    [class*="sidebarList_"],
    [class*="membersWrap_"],
    [class*="members_"],
    [class*="profilePanel_"],
    [class*="nowPlayingColumn_"] {
        display: none !important;
    }

    [class*="base_"] > [class*="content_"] {
        display: flex !important;
        left: 0 !important;
        margin-left: 0 !important;
        max-width: none !important;
        width: 100vw !important;
    }

    #app-mount [class*="base_"] > [class*="content_"] > [class*="chat_"] {
        flex: 1 1 auto !important;
        left: 0 !important;
        margin-left: 0 !important;
        max-width: none !important;
        width: 100vw !important;
    }

    #app-mount [class*="base_"] > [class*="content_"] > [class*="chat_"] [class*="chatContent_"] {
        flex: 1 1 auto !important;
    }
`;

function isAllowedChannelUrl(url: string, senderUrl: string) {
    try {
        const parsed = new URL(url);
        if (!/^\/channels\/(?:@me|\d+)\/\d+(?:\/\d+)?\/?$/.test(parsed.pathname)) return false;

        try {
            const sender = new URL(senderUrl);
            if (sender.protocol === "http:" || sender.protocol === "https:") return parsed.origin === sender.origin;
        } catch {
            return allowedDiscordOrigins.has(parsed.origin);
        }

        return allowedDiscordOrigins.has(parsed.origin);
    } catch {
        return false;
    }
}

function clampInteger(value: number, fallback: number, min: number, max: number) {
    if (!Number.isFinite(value)) return fallback;
    return Math.min(Math.max(Math.trunc(value), min), max);
}

function sanitizeColor(value: string) {
    return /^#[\da-f]{6}$/i.test(value) ? value : defaultOptions.backgroundColor;
}

function sanitizeOptions(options: Partial<ConversationWindowOptions> | null | undefined): ConversationWindowOptions {
    const merged = { ...defaultOptions, ...options };

    return {
        autoHideMenuBar: merged.autoHideMenuBar,
        backgroundColor: sanitizeColor(merged.backgroundColor),
        compactMode: merged.compactMode,
        devTools: merged.devTools,
        focusExistingWindow: merged.focusExistingWindow,
        height: clampInteger(merged.height, defaultOptions.height, 320, 2160),
        minHeight: clampInteger(merged.minHeight, defaultOptions.minHeight, 320, 2160),
        minWidth: clampInteger(merged.minWidth, defaultOptions.minWidth, 320, 3840),
        reuseExistingWindow: merged.reuseExistingWindow,
        title: merged.title.trim() || defaultOptions.title,
        width: clampInteger(merged.width, defaultOptions.width, 320, 3840)
    };
}

export async function openConversationWindow(event: IpcMainInvokeEvent, url: string, channelId: string, rawOptions?: Partial<ConversationWindowOptions> | null): Promise<boolean> {
    if (event.sender.isDestroyed()) return false;
    if (!isAllowedChannelUrl(url, event.sender.getURL())) return false;

    const options = sanitizeOptions(rawOptions);
    const existing = windows.get(channelId);
    if (options.reuseExistingWindow && existing && !existing.isDestroyed()) {
        if (existing.webContents.getURL() !== url) await existing.loadURL(url);
        if (options.focusExistingWindow) existing.focus();
        return true;
    }

    const windowKey = options.reuseExistingWindow
        ? channelId
        : `${channelId}-${Date.now()}-${windows.size}`;

    const win = new BrowserWindow({
        width: options.width,
        height: options.height,
        minWidth: options.minWidth,
        minHeight: options.minHeight,
        title: options.title,
        backgroundColor: options.backgroundColor,
        autoHideMenuBar: options.autoHideMenuBar,
        show: false,
        webPreferences: {
            backgroundThrottling: false,
            contextIsolation: true,
            devTools: options.devTools,
            preload: process.env.DISCORD_PRELOAD,
            sandbox: false,
            session: event.sender.session
        }
    });

    windows.set(windowKey, win);
    win.on("closed", () => windows.delete(windowKey));
    win.webContents.setUserAgent(event.sender.getUserAgent());
    win.webContents.setWindowOpenHandler(({ url }) => {
        try {
            const parsed = new URL(url);
            if (parsed.protocol === "https:" || parsed.protocol === "http:") void shell.openExternal(url);
        } catch { /* invalid URL, ignore */ }
        return { action: "deny" };
    });

    win.webContents.once("dom-ready", async () => {
        if (options.compactMode) await win.webContents.insertCSS(compactConversationCss);
        win.show();
        win.focus();
    });

    await win.loadURL(url);
    return true;
}
